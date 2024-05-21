const MongoClient = require("mongodb").MongoClient;
const dotenv = require("dotenv");
dotenv.config();

const url = process.env.DB_URL;

let db = null;

// Connect to Mongo
MongoClient.connect(url, { useUnifiedTopology: true }, function (err, client) {
	console.log("Connected successfully to db server");
	//Connect to the corect DB within Mongo
	db = client.db("StarDash");
});

//--------------------------------------NEW USER---------------------------------//

/**
 * Creates a new admin in admindata
 * @param manager - A string holding the manager name input from the frontend
 * @param password - A string containing the password cooresponding to the manager
 * The function takes in and writes the manager name and password to the database
 * @return Success or failure
 */
function writeNewAdmin(manager, password) {
	return new Promise((resolve, reject) => {
		const admindata = db.collection(`admindata`);
		admindata.insertOne(
			{ username: manager, password: password },
			function (err, body) {
				err ? reject(err) : resolve(body);
			}
		);
	});
}

/**
 * Write a new event instance
 * @param eventObject - A huge object containing all the event data
 * Writes the event to the correct event collection
 * @returns Success or failure
 */
function writeEvent(eventObject) {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${eventObject.event}`);
		eventdata.insertOne(eventObject, function (err, body) {
			err ? reject(err) : resolve(body);
		});
	});
}

/**
 * Writes event into manager registered events
 * @param event - A string holding the event from the frontend
 * @param newManager - A string holding the manager who is logged in making the request
 * @param leadManager - A string holding the lead manager associated with the event
 * Takes in both leadManager and event and adds the new event to the newManager's event list
 * @return Success or failure
 */
function writeEventAssociation(event, newManager, leadManager) {
	return new Promise((resolve, reject) => {
		const eventObject = {
			event,
			leadManager,
		};
		const managerEventList = db.collection("managerEventList");
		managerEventList
			.updateOne(
				{ manager: newManager },
				{ $push: { eventList: eventObject } },
				{ upsert: true }
			)
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

//-----------------------------------------LOGIN---------------------------------//

/**
 * Searches for a manager in the database
 * @param username - A string holding the manager name input from the frontend
 * The function takes in the manager and searches for it in the admindata collection.
 * @return If found, it'll return the full manager object. If not found, will return NULL
 */
function verifyManagerExists(manager) {
	return new Promise((resolve, reject) => {
		const admindata = db.collection("admindata");
		admindata
			.findOne({ username: new RegExp("^" + manager + "$", "i") }) //For exact search, case insensitive
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Returns event names and hours from the database
 * *Needs no paramaters*
 * Searches and returns the full list of active events in the database "event" collection
 * @return A one dimensional array of events and their hours as objects within the array
 */
function returnHours() {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection("event");
		eventdata.find({}).toArray(function (err, docs) {
			err ? reject(err) : resolve(docs);
		});
	});
}

/**
 * Returns event names and types from the database
 * *Needs no paramaters*
 * Searches and returns the full list of active events in the database "eventType" collection
 * @return A one dimensional array of events and their type as objects within the array. Type is either "M" for Marathon or "C" for CheerfulCarnival
 */
function returnHoursAndType() {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection("eventType");
		eventdata.find({}).toArray(function (err, docs) {
			err ? reject(err) : resolve(docs);
		});
	});
}

/**
 * Return full event data
 * @param event - A string holding the event name
 * @param manager - A string holding the current manager who's making the request
 * @param leadManager - A string holding the lead manager name, could be the same as the manager param
 * Searches through the event collection to find the event that had the leadManager as the leadManager as well as the manager in the manager array
 * @returns The full event object or an empty array
 */
function returnEventData(event, manager, leadManager) {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		eventdata
			.find({ leadManager: leadManager, managers: manager })
			.toArray(function (err, docs) {
				err ? reject(err) : resolve(docs);
			});
	});
}

//------------------------------------MODIFY EXISTING----------------------------//

/**
 * Write the runners team to the DB
 * @param filler - A string holding the event name
 * This function writes to the userdata collection, inserting the users teams and name or changing what's already there
 * @returns Success or failure
 */
function writeFillerData(filler) {
	return new Promise((resolve, reject) => {
		const userdata = db.collection(`userdata`);
		userdata
			.updateOne(
				{
					"userData.discordName": filler.discordName,
					"userData.event": filler.event,
				},
				{
					$set: {
						"userData.teams": filler.teams,
					},
				},
				{ upsert: true }
			)
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Write the runners team to the DB
 * @param body.event - A string holding the event name
 * @param body.manager - A string holding the managers name
 * @param body.runner - An object holding the runner team data
 * This function writes to the event collection, finding the iteration of the event by the manager and setting
 * the runner data to the updated values passed in
 * @returns Success or failure
 */
function writeRunnerTeam(event, leadManager, runner) {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		eventdata
			.updateOne(
				{ leadManager: leadManager },
				{
					$set: {
						runner: {
							name: runner.name,
							isv1: runner.isv1,
							isv2: runner.isv2,
							bp: runner.bp,
						},
					},
				},
				{ upsert: true }
			)
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Saves the admin schedule in the database
 * @param event - The event to write to
 * @param leadManager - The leadManager associated with the event
 * @param manager - The manager making the request
 * @param schedule - The schedule array
 * @param activeTeamDropdown - The boolean determining if the team is complete or not
 * @param notesPerHour - An array of strings associated with each hour
 * @param teamsPerHour - The chosen team of the hour
 * This function writes to the event collection coorespoinding to the event passed in, and updates the schedule array of the event iteration that the passed manager is a part of as well as other paramaters that assist the frontend in displaying correctly. The manager is checked against with the leadManager as a security measure to ensure the manager making the request has access to write to the schedule.
 * @return A success or failure message
 */
function writeAdminSchedule(
	event,
	leadManager,
	manager,
	schedule,
	activeTeamDropdown,
	notesPerHour,
	teamsPerHour
) {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		eventdata
			.updateOne(
				{ leadManager: leadManager, managers: manager },
				{
					$set: {
						schedule: schedule,
						activeTeamDropdown: activeTeamDropdown,
						notesPerHour: notesPerHour,
						teamsPerHour: teamsPerHour,
					},
				},
				{ upsert: false }
			)
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Deletes one manager
 * @param event - Event that the schedule belongs to
 * @param leadManager - Manager associated with the event as a string
 * @param removeTarget - The manager to be removed as a string
 * Deletes the deleteTarget from the manager list based on the leadManager signature and event title
 * @returns Success or fail
 */
function deleteOneManager(event, leadManager, deleteTarget) {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		eventdata
			.updateOne(
				{ leadManager: leadManager },
				{ $pull: { managers: deleteTarget } }
			)
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Deletes one event
 * @param manager - The manager that's events are being wiped
 * Deletes the deleteTarget from the manager list based on the leadManager signature and event title
 * @returns Success or fail
 */
function removeOneEvent(event, leadManager) {
	console.log(
		`Removed `,
		leadManager,
		` from `,
		event,
		` in DAL removeOneEvent`
	);
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		eventdata
			.removeOne({ leadManager: leadManager })
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Deletes manager from one events managers list
 * @param manager - The manager that's events are being wiped
 * Deletes the deleteTarget from the manager list based on the leadManager signature and event title
 * @returns Success or fail
 */
function removeManagerFromManagerList(event, deleteTarget) {
	console.log(
		`Removed `,
		deleteTarget,
		` from `,
		event,
		` in DAL removeManagerFromManagerList`
	);

	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		eventdata
			.updateOne({ $pull: { managers: deleteTarget } })
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Deletes manager from admindata collection
 * @param manager - The manager that's being wiped
 * Deletes the manager from the admindata collection
 * @returns Success or fail
 */
function deleteManagerFromAdmindata(manager) {
	return new Promise((resolve, reject) => {
		const admindata = db.collection(`admindata`);
		admindata
			.removeOne({ username: manager })
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}
/**
 * Deletes manager from managerEventList collection
 * @param manager - The manager that's being wiped
 * Deletes the manager from the admindata collection
 * @returns Success or fail
 */
function deleteManagerFromEventList(manager) {
	return new Promise((resolve, reject) => {
		const admindata = db.collection(`managerEventList`);
		admindata
			.removeOne({ username: manager })
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Deletes one filler
 * @param event - Event that the schedule belongs to
 * @param leadManager - Manager associated with the event as a string
 * @param removeTarget - The manager to be removed as a string
 * Calls to get the schedule for the passed manager and event
 * @returns A schedule array
 */
function deleteOneFiller(event, leadManager, deleteTarget) {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		eventdata
			.updateOne(
				{ leadManager: leadManager },
				{ $pull: { associatedUsers: deleteTarget } }
			)
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Adds new manager to manager list in database
 * @param event - Event that the schedule belongs to
 * @param leadManager - Manager associated with the event as a string
 * @param newManager - The manager to be added as a string
 * @param runPassword - The run password to check against as a string
 * First verifies the event doesn't already contain the manager trying to add themselves, then updates the event with the new manager if the run password is correct
 * @returns A schedule array
 */
function addManagerToRun(event, leadManager, newManager, runPassword) {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		eventdata
			.findOne({
				leadManager: leadManager,
				runPassword: runPassword,
				managers: newManager,
			})
			.then((doc) => {
				if (doc === null) {
					eventdata
						.updateOne(
							{ leadManager: leadManager, runPassword: runPassword },
							{ $push: { managers: newManager } }
						)
						.then((doc) => resolve(doc))
						.catch((err) => reject(err));
				} else {
					resolve(doc);
				}
			})
			.catch((err) => reject(err));
	});
}

//----------------------------------RETURN EXISTING DATA-------------------------//

/**
 * Loads the admin schedule in the database
 * @param event - The event to read from
 * @param leadManager - The lead manager signature
 * The function searches the event collection and pulls back the schedule associated with the leadmanager
 * The schedule: 1 returns just the schedule
 * @return A multilayer array of names
 */
function returnAdminSchedule(event, leadManager) {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		//Variables from the passed data
		eventdata
			.findOne(
				{ leadManager: leadManager },
				{
					schedule: 1,
				}
			)
			//!		WHAT DOES THIS RETURN??????????? THE WHOLE OBJECT OR JUST THE SCHEDULE???????
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Returns the entire managerEventList collection in an array format
 * *Needs no params
 * @return An array of objects with managers and their event arrays they've registered for
 */
function returnAllEventList() {
	return new Promise((resolve, reject) => {
		const managerEventList = db.collection(`managerEventList`);
		//Variables from the passed data
		managerEventList.find().toArray(function (err, docs) {
			err ? reject(err) : resolve(docs);
		});
	});
}

/**
 * Deletes the delete target from the other managers event list
 * *Needs no params
 * @return An array of objects with managers and their event arrays they've registered for
 */
function removeManagerFromEventList(manager, deleteTarget) {
	return new Promise((resolve, reject) => {
		const managerEventList = db.collection(`managerEventList`);
		//Variables from the passed data
		managerEventList
			.updateOne({ manager: manager }, { $pull: { managers: deleteTarget } })
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Verifies the manager is lead of one event
 * @param event - The event to verify against
 * @param manager - The manager attempting to create the event
 * Searches the event to ensure the manager passed in is not already a lead manager for that event.
 * @return An empty array or the event object cooresponding to the manager
 */
function verifyDuplicateEvent(event, manager) {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		eventdata.find({ leadManager: manager }).toArray(function (err, docs) {
			err ? reject(err) : resolve(docs);
		});
	});
}

/**
 * Finds the teams associated with the user
 * @param filler - A string holding the users name
 * This function finds the user object and pulls back the overarching object that the match
 * was found in.
 * @returns An object called userData that contains the users discord name - the search parameter - and their team object
 */
function returnOneTeam(filler, event) {
	return new Promise((resolve, reject) => {
		const userdata = db.collection("userdata");
		userdata
			.find({ "userData.discordName": filler, "userData.event": event })
			.toArray(function (err, docs) {
				err ? reject(err) : resolve(docs);
			});
	});
}

/**
 * Returns a managers registered events
 * @param manager - A string holding the manager name input from the frontend
 * Takes in the manager name and returns the event list associated
 * @return The full manager event list or null
 */
function returnEventsForManager(manager) {
	return new Promise((resolve, reject) => {
		const managerEventList = db.collection("managerEventList");
		managerEventList
			.findOne({ manager: manager })
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

//! pretty sure this isn't needed
//  * Returns the associated users
//  * @param event - A string holding the event name
//  * @param manager - A string holding the managers name
//  * This function returns the whole associated users array from the event
//  * @returns An array of strings
//  */
// function returnTeamsAssociatedWithManager(event, manager) {
// 	return new Promise((resolve, reject) => {
// 		db.collection(`${event}`)
// 			.find({ leadManager: manager })
// 			.toArray(function (err, docs) {
// 				err ? reject(err) : resolve(docs);
// 			});
// 	});
// }

//----------------------------------FILLER INTERACTIONS-------------------------//

/**
 * Writes a new filler to the database
 * @param body.discordName - The name of the filler
 * @param body.teams - The fillers teams
 * Packages the user object into the userObject which is then written to the database
 * @return The full manager event list or null
 */
function writeNewFiller(body, event) {
	return new Promise((resolve, reject) => {
		const userdata = db.collection("userdata");
		const discordName = body.discord;
		const teams = body.teams;
		//userData is a wrapper for the object to be written in to the DB cleaner
		//not to be confused with the database name!
		const userObject = {
			userData: {
				discordName: discordName,
				teams: teams,
				event: event,
			},
		};
		userdata.insertOne(userObject, function (err, body) {
			err ? reject(err) : resolve(body);
		});
	});
}

/**
 * Adds filler to the associatedUsers list in an event iteration
 * @param body.event - The name of the event to add to
 * @param body.manager - The name of the manager to ensure the correct iteration of the event is added to
 * @param body.discord - The fillers name to be added to the array of fillers associated to the event
 * Appends the associatedUser array with the passed manager, only adding the new value and not otherwise altering the array
 * @return The full manager event list or null
 */
function addFillerToAssociatedUser(event, body) {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		const leadManager = body.leadManager;
		eventdata
			.updateOne(
				{ leadManager: leadManager },
				{
					$push: {
						associatedUsers: body.discord,
					},
				},
				{ upsert: false }
			)
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

/**
 * Searches for a user in the database
 * @param event - The event a fillers team should be associated with
 * @param filler - A string holding the filler name input from the frontend
 * The function takes in the user and searches for it in the userdata collection.
 * @return Full user object or null
 */
function verifyUserExists(event, leadManager, filler) {
	return new Promise((resolve, reject) => {
		const eventdata = db.collection(`${event}`);
		eventdata
			.findOne({ leadManager: leadManager, associatedUsers: filler })
			.then((doc) => resolve(doc))
			.catch((err) => reject(err));
	});
}

module.exports = {
	//new user
	writeNewAdmin,
	writeEvent,
	writeEventAssociation,
	//login
	verifyManagerExists,
	returnHours,
	returnEventData,
	//modify existing data
	writeFillerData,
	writeRunnerTeam,
	writeAdminSchedule,
	deleteOneManager,
	deleteOneFiller,
	addManagerToRun,
	//return existing data
	returnAdminSchedule,
	verifyDuplicateEvent,
	returnOneTeam,
	returnEventsForManager,
	// returnTeamsAssociatedWithManager,
	//filler interactions
	verifyUserExists,
	writeNewFiller,
	addFillerToAssociatedUser,
	returnHoursAndType,
	deleteManagerFromAdmindata,
	removeOneEvent,
	removeManagerFromManagerList,
	deleteManagerFromEventList,
	returnAllEventList,
	removeManagerFromEventList,
};
