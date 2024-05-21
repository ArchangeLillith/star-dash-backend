var express = require("express");
var app = express();
var cors = require("cors");
var dal = require("./dal.js");
const { rejects } = require("assert");
var bcrypt = require("bcryptjs");
const { list } = require("mongodb/lib/gridfs/grid_store.js");

// used to serve files
app.use(express.json());
app.use(cors());

/**
 * Login function
 * @param req.body - Object with two strings that were lifted from user input
 * When called, calls to the DAL to find if there is a matching username that's registered as a manager. The DAL returns
 * an array of user objects which should only include the one username that was passed from the frontend
 * if that username exists in our database.
 * It also checks that manager against the password that was given and the password we have in our database.
 * @returns Either a username if all checks were passed or an error if username or password are incorrect.
 * Future consideration
 * TODO Does having it in an array pose security risks?*/
app.post("/account/login/", function (req, res) {
	dal.verifyManagerExists(req.body.manager).then((user) => {
		if (user !== null) {
			bcrypt.compare(req.body.password, user.password, function (err, hashRes) {
				if (hashRes) {
					dal.returnEventsForManager(req.body.manager).then((events) => {
						if (events === null) {
							res.send(user);
						} else {
							res.send(events);
							console.log(events);
						}
					});
				} else {
					res.send({
						error: {
							data: "password incorrect",
						},
					});
				}
			});
		} else {
			res.send({
				error: {
					data: "user not found",
				},
			});
		}
	});
});

/**
 * Writes a users Cheerful Carnival teams to the database and updates the associated event
 * @param req.body - A large object containing all data lifted from input from frontend
 * @param req.body.manager - A string holding the leadManagers name, not changed because of
 * Calls and verifies the manager the user has input exists. If not, throws an error. If a manager is found, then checks to see if the user exists in the event already and if so throws an error. After those checks pass, then calls to the database and writes the fillers new teams into the database and edits the associatedUsers array within the correct event iteration.
 * @returns An error if manager isn't found, an error if user is already in that run, an error if DAL fails or a success message to verify data was written
 */
//Good example of error handling on backend
app.post("/start/dash/cheerful/", async function (req, res) {
	console.log(`Start Dash Cheerful BACKEND`);
	const managerVerif = await dal.verifyManagerExists(
		req.body.cheerfulBody.leadManager
	);
	if (managerVerif === null)
		res.send({
			error: {
				data: "There is no manager of that name",
			},
		});
	const userVerif = await dal.verifyUserExists(
		req.body.event,
		req.body.cheerfulBody.leadManager,
		req.body.cheerfulBody.discord
	);
	if (userVerif !== null)
		res.send({
			error: {
				data: "There is already a user of that name in this event, please choose another name or contact your manager team if you need to change stats! ",
			},
		});
	else {
		dal.writeNewFiller(req.body.cheerfulBody, req.body.event);
		dal
			.addFillerToAssociatedUser(req.body.event, req.body.cheerfulBody)
			.then((dataImGettingBack) => {
				res.send(dataImGettingBack);
			});
	}
});

/**
 * Writes a users Marathon teams to the database and updates the associated event
 * @param req.body - A large object containing all data lifted from input from frontend
 * @param req.body.manager - A string holding the managers name
 * Calls and verifies the manager the user has input exists. If not, throws an error. If a manager is found, then checks to see if the user exists in the event already and if so throws an error. After those checks pass, then calls to the database and writes the fillers new teams into the database and edits the associatedUsers array within the correct event iteration. This is where encore teams are pulled out and added seperatly from the regular teams to differenciate more clearly. The encore team is named in the frontend data scrape as the object is built before the call is made.
 * @returns An error if manager isn't found, an error if user is already in that run, an error if DAL fails or a success message to verify data was written
 */
app.post("/start/dash/marathon/", async function (req, res) {
	const managerVerif = await dal.verifyManagerExists(
		req.body.marathonBody.fillTeam.manager
	);
	console.log("Manager verification:", managerVerif);
	if (managerVerif === null)
		res.send({
			error: {
				data: "There is no manager of that name",
			},
		});
	const userVerif = await dal.verifyUserExists(
		req.body.marathonBody.fillTeam.eventState,
		req.body.marathonBody.fillTeam.manager,
		req.body.marathonBody.fillTeam.discord
	);
	console.log(`User verif:`, userVerif);
	if (userVerif !== null)
		res.send({
			error: {
				data: "There is already a user of that name in this event, please choose another name or contact your manager team if you need to change stats! ",
			},
		});
	else {
		if (req.body.marathonBody.encoreTeam) {
			dal.writeNewFiller(
				req.body.marathonBody.fillTeam,
				req.body.marathonBody.fillTeam.eventState
			);
			dal.writeNewFiller(
				req.body.marathonBody.encoreTeam,
				req.body.marathonBody.fillTeam.eventState
			);
			dal.addFillerToAssociatedUser(
				req.body.marathonBody.fillTeam.eventState,
				req.body.marathonBody.fillTeam
			);
			dal
				.addFillerToAssociatedUser(
					req.body.marathonBody.encoreTeam.eventState,
					req.body.marathonBody.encoreTeam
				)
				.then((dataImGettingBack) => {
					res.send(dataImGettingBack);
				});
		} else {
			dal.writeNewFiller(
				req.body.marathonBody.fillTeam,
				req.body.marathonBody.fillTeam.eventState
			);
			dal
				.addFillerToAssociatedUser(
					req.body.marathonBody.fillTeam.eventState,
					req.body.marathonBody.fillTeam
				)
				.then((dataImGettingBack) => {
					res.send(dataImGettingBack);
				});
		}
	}
});

/**
 * Returns the event names
 * *Needs no paramaters
 * Grabs the event collection and returns all the events and their hours
 * @returns An array of events and their associated hours
 */
app.post("/return/event/names/and/hours", function (req, res) {
	dal.returnHours().then((event) => {
		res.send(event);
	});
});

/**
 * Returns the event names
 * *Needs no paramaters
 * Grabs the event collection and returns all the events and their hours
 * @returns An array of events and their associated hours
 */
app.post("/return/event/names/with/type", function (req, res) {
	dal.returnHoursAndType().then((event) => {
		res.send(event);
	});
});

/**
 * Writes the event into the manager associated events list after initial creation from CreateRun.jsx
 * @param req.body.manager - Manager to be written to
 * @param req.body.manager(2nd) - Lead manager signature
 * @param req.body.event - Event to be added
 * First verifies that the manager isn't a lead of that event, then if the check returns nothing, writes that event
 * to the managers registered events. If the return from the check returns something (which would be the full event object),
 * the manager is already a lead and cannot register so an error is passed back. The manager is thrown in twice because the DAL expects (event, manager, leadManager) and this call is only used when a user creates a new event iteration. This means that the manager IS the lead manager.
 * @returns A success or failure
 */
app.post("/write/event/association", async function (req, res) {
	let eventCheck = await dal.verifyDuplicateEvent(
		req.body.event,
		req.body.manager
	);
	if (eventCheck.length > 0) {
		res.send("Event already registered for as a lead manager");
	} else {
		await dal.writeEventAssociation(
			req.body.event,
			req.body.manager,
			req.body.manager
		);
		res.send("Successfully written to DB");
	}
});

/**
 * Pulls managers saved team data
 * @param req.body.event - Event that the schedule belongs to
 * @param req.body.leadManager - The lead manager's signature to get the correct event iteration
 * Calls to get the schedule for the passed leadManager and event
 * @returns A schedule array
 */
app.post("/recall/schedule/", function (req, res) {
	dal
		.returnAdminSchedule(req.body.event, req.body.leadManager)
		.then((schedule) => {
			res.send(schedule.schedule);
		});
});

/**
 * Deletes one manager from a run
 * @param req.body.event - Event that the schedule belongs to
 * @param req.body.leadManager - Lead manager name as a string
 * @param req.body.removeTarget - The manager to be removed as a string
 * Deletes the deleteTarget from the manager list based on the leadManager signature and event title
 * @returns Success or fail
 */
app.post("/remove/one/manager/", function (req, res) {
	dal
		.deleteOneManager(
			req.body.event,
			req.body.leadManager,
			req.body.removeTarget
		)
		.then((response) => res.send(response));
});

/**
 * Deletes one manager from EVERYTHING
 * @param req.body.event - Event that the schedule belongs to
 * @param req.body.leadManager - Lead manager name as a string
 * @param req.body.removeTarget - The manager to be removed as a string
 * Deletes the deleteTarget from the manager list based on the leadManager signature and event title
 * @returns Success or fail
 */
app.post("/remove/manager/completley", async function (req, res) {
	const eventList = await dal.returnHours();
	const managerEventList = await dal.returnAllEventList();
	//delete all their events where they're the lead manager
	for (let i = 0; i < eventList.length; i++) {
		dal.removeOneEvent(eventList[i].event, req.body.removeTarget);
	}
	//delete the events that no longer exist from other managers event lists
	for (let i = 0; i < managerEventList; i++) {
		dal.removeManagerFromEventList(
			managerEventList[i].manager,
			req.body.removeTarget
		);
	}
	//needs to loop and delete from every active iteration of an event
	for (let i = 0; i < eventList.length; i++) {
		dal.removeManagerFromManagerList(eventList[i].event, req.body.removeTarget);
	}
	//delete from managerEventList
	dal
		.deleteManagerFromEventList(req.body.removeTarget)
		.then((response) => console.log(response));
	//delete from admindata as well
	dal
		.deleteManagerFromAdmindata(req.body.removeTarget)
		.then((response) => console.log(response));
});

/**
 * Deletes one filler
 * @param req.body.event - Event that the schedule belongs to
 * @param req.body.leadManager - Lead manager name as a string
 * @param req.body.removeTarget - The filler to be removed as a string
 * Deletes the passed filler from the associated users array of the event iteration based on the leadManager signature and the event title
 * @returns Success or fail
 */
app.post("/remove/one/filler/", function (req, res) {
	dal
		.deleteOneFiller(
			req.body.event,
			req.body.leadManager,
			req.body.removeTarget
		)
		.then((response) => res.send(response));
});

/**
 * Writes managers saved team data
 * @param req.body.event - Event that is being written to
 * @param req.body.manager - Manager associated with event
 * @param req.body.schedule - Schedule that's being written to the database
 * @param req.body.activeTeamDropdown - Array of booleans keeping track of which teams are completed
 * @param req.body.notesPerHour - Array of notes cooresponding to the hours
 * @param req.body.teamsForHour - Array of the chosen team per hour, not to be confused with the activeTeamDropdown which is purely a boolean for display functionality
 * Calls to the DAL to write passed schedule and other arrays to the event iteration
 * @returns A success or failure message
 */
app.post("/save/schedule/", function (req, res) {
	dal
		.writeAdminSchedule(
			req.body.event,
			req.body.leadManager,
			req.body.manager,
			req.body.schedule,
			req.body.activeTeamDropdown,
			req.body.notesPerHour,
			req.body.teamsPerHour
		)
		.then((dataImGettingBack) => {
			res.send(dataImGettingBack);
		});
});

/**
 * Write runner data
 * @param req.body.event - The event the runner is associated with
 * @param req.body.leadManager - The leadManager associated with the run
 * @param req.body.runner - An object with runner stats inside
 * Calls to the DAL to write runner data into the correct iteration of the event based on the passed paramaters
 * @returns A success or failure message
 */
app.post("/write/runner/team/", function (req, res) {
	console.log(req.body);
	dal
		.writeRunnerTeam(req.body.event, req.body.leadManager, req.body.runner)
		.then((dataImGettingBack) => {
			res.send(dataImGettingBack);
		});
});

/**
 * Checks if manager is lead of same event
 * @param req.body.event - The event we're checking for
 * @param req.body.manager - The manager associated
 * Calls to the DAL to verify the manager isn't a lead manager of the same event passed
 * @returns A success or failure message
 */
app.post("/verify/event/duplicate", function (req, res) {
	dal
		.verifyDuplicateEvent(req.body.event, req.body.manager)
		.then((dataImGettingBack) => {
			console.log(dataImGettingBack.length);
			if (dataImGettingBack.length === 0) {
				res.send(dataImGettingBack);
			} else {
				res.send({
					error: {
						data: "User already has this event registered for",
					},
				});
			}
		});
});

// /**
//  * Return all associated user objects
//  * @param req.body.event - The event in which we're querying
//  * @param req.body.manager - The manager whose associated users we're attempting to return
//  * Calls DAL to return a list of associated users and loops over that array that calls to the DAL again.
//  * The second DAL call returns the user object, then that object is pushed into an array to be returned.
//  * @returns An array of user objects
//  */
// app.post("/return/all/users", async function (req, res) {
// 	console.log(
// 		`This is suspected to never be hit, if this is shown this means "return/all/users" as a post DOES get hit and shoulnd't be taken out!!`
// 	);
// 	let teamArray = [];
// 	const runObject = await dal.returnTeamsAssociatedWithManager(
// 		req.body.event,
// 		req.body.manager
// 	);
// 	const associatedUsers = runObject[0].associatedUsers;
// 	for (let i = 0; i < associatedUsers.length; i++) {
// 		const team = await dal.returnOneTeam(associatedUsers[i]);
// 		teamArray.push(team[0].userData);
// 	}
// 	res.send(teamArray);
// });

/**
 * Return the four fillers as setup for TeamMatcher(tm)
 * @param req.body.fillers - A one dimensional array containing the filler names
 * @param req.body.event - The event that cooresponds to the fillers teams
 * Calls DAL to return a team per filler name and adds those to a larger array to be returned, sorted by the specific event teams for each filler
 * @returns An array of user objects
 */
app.post("/return/teams/per/hour", async function (req, res) {
	console.log(req.body);
	const teamsForHour = [];
	for (let i = 0; i < req.body.fillers.length; i++) {
		const userObject = await dal.returnOneTeam(
			req.body.fillers[i],
			req.body.event
		);
		teamsForHour.push(userObject);
	}
	console.log(teamsForHour);
	res.send(teamsForHour);
});

/**
 * Returns the runner data
 * @param req.body.event - The event in which we're querying
 * @param req.body.manager - The manager who's making the request
 * @param req.body.leadManager - The lead manager signature to get the correct event iteration
 * Calls DAL to return the runner of that event. While it only returns the runner, it does get back from the DAL
 * the whole run object and cuts out what it needs before returning to the front end
 * @returns A runner object
 */
app.post("/return/runner/data", async function (req, res) {
	const eventObject = await dal.returnEventData(
		req.body.event,
		req.body.manager,
		req.body.leadManager
	);
	const runnerData = eventObject[0].runner;
	res.send(runnerData);
});

/**
 * Returns the whole event object
 * @param req.body.event - The event in which we're querying
 * @param req.body.manager - The manager who's making the request
 * @param req.body.leadManager - The leadManager signature to get the correct event iteration
 * Calls DAL to return the entire event object, deleting the run password out of the return before the frontend gets the data
 * @returns The whole event object EXCEPT runPassword
 */
app.post("/return/context", async function (req, res) {
	let eventObject = await dal.returnEventData(
		req.body.event,
		req.body.manager,
		req.body.leadManager
	);
	delete eventObject[0]?.runPassword;
	res.send(eventObject);
});

/**
 * Returns the associated users array
 * @param req.body.event - The event in which we're querying
 * @param req.body.manager - The manager who's making the request
 * @param req.body.leadManager - The leadManager signature to get the correct event iteration
 * Calls to get the entire event object and pulls out only the associated users and passes that to the frontend
 * @returns The associated users array
 */
app.post("/return/associated/users", async function (req, res) {
	const eventObject = await dal.returnEventData(
		req.body.event,
		req.body.manager,
		req.body.leadManager
	);
	const associatedUsers = eventObject[0].associatedUsers;
	res.send(associatedUsers);
});

/**
 * Returns the managers associated with event iteration based on passed params
 * @param req.body.event - The event in which we're querying
 * @param req.body.manager - The manager who's making the request
 * @param req.body.leadManager - The leadManager signature to get the correct event iteration
 * Calls to get the entire event object and pulls out only the managers array and passes that to the frontend
 * @returns tThe managers array
 */
app.post("/return/all/managers", async function (req, res) {
	const eventObject = await dal.returnEventData(
		req.body.event,
		req.body.manager,
		req.body.leadManager
	);
	const managerRes = eventObject[0].managers;
	res.send(managerRes);
});

/**
 *	Writes the whole event object
 * @param req.body - The event object
 * Writes the whole event object to the database
 * @returns A success or failure
 */
app.post("/write/event", async function (req, res) {
	dal.writeEvent(req.body).then((response) => {
		res.send(response);
	});
});

/**
 *	Writes filler changes
 * @param req.body - an array of fillers and their data
 * Loops over the passed array and writes each to the database in the userdata collection, overwriting what was there
 * @returns A success or failure
 */
app.post("/write/new/fillers", function (req, res) {
	console.log(req.body);
	for (let i = 0; i < req.body.length; i++) {
		dal.writeFillerData(req.body[i]).then((dataImGettingBack) => {
			res.send(dataImGettingBack);
		});
	}
});

/**
 *	Writes a new admin
 * @param req.body.manager - The chosen manager name
 * @param req.body.password - The chosen password
 * Writes the new manager to the databse if the manager doesn't already exist
 * @returns A success or failure
 */
app.post("/write/admin", function (req, res) {
	console.log(req.body);
	dal.verifyManagerExists(req.body.manager).then((user) => {
		if (user === null) {
			dal
				.writeNewAdmin(req.body.manager, req.body.password)
				.then((dataImGettingBack) => {
					res.send(dataImGettingBack);
				});
		} else {
			res.send({
				error: {
					data: `User of that name already created, please choose another. Case doesn't matter! 'Lillith' and 'lillith' are the same here.`,
				},
			});
		}
	});
});

/**
 *	Writes a new manager to an existing run iteration
 * @param req.body.event - The event title
 * @param req.body.leadManager - The lead manager name
 * @param req.body.newManager - The manager making the request and asking to be added to the event iteration
 * @param req.body.password - The run password
 * Calls the database and ensures the event iteration exists and the run password is a match. If this passes, the DAL is called and the manager is written into the managers array of the event iteration cooresponding to the event title and lead manager signature
 * @returns The context for the event the manager just registered for
 */
app.post("/write/manager/to/run", async function (req, res) {
	console.log(req.body);
	const duplicateVerif = await dal.returnEventData(
		req.body.event,
		req.body.newManager,
		req.body.leadManager
	);
	if (duplicateVerif.length === 0) {
		dal
			.addManagerToRun(
				req.body.event,
				req.body.leadManager,
				req.body.newManager,
				req.body.runPassword
			)
			.then((dataImGettingBack) => {
				if (dataImGettingBack.modifiedCount === 0) {
					res.send({
						error: {
							data: "Sorry, there is no event like this. Please ensure you have eveything spelled and capatalized exactly as your manager gave it to you.",
						},
					});
				}
				dal.writeEventAssociation(
					req.body.event,
					req.body.newManager,
					req.body.leadManager
				);
				const eventObject = dal.returnEventData(
					req.body.event,
					req.body.newManager,
					req.body.leadManager
				);
				delete eventObject[0]?.runPassword;
				res.send(eventObject);
			});
	} else {
		res.send({
			error: {
				data: "You're already involved with the event you're trying to register for!",
			},
		});
	}
});

var port = 8080;
app.listen(port);
console.log("Running on port: " + port);

/** ENDPOINTS YOU CAN HIT
 * "/account/login/"
 * "/start/dash/cheerful/"
 * "/start/dash/marathon/"
 * "/return/event/names"
 * "/write/event/association"
 * "/recall/schedule/"
 * "/save/schedule/"
 * "/write/runner/team/"
 * "/verify/event/duplicate"
 * "/return/all/users"
 * "/return/teams/per/hour"
 * "/return/runner/data"
 * "/return/context"
 * "/write/event"
 * "/write/new/fillers"
 * "/write/admin"
 * /write/manager/to/run
 */
