const logger = require("../../utils/logger");

const Users = require("../controllers/users");
const Threads = require("../controllers/threads");

function handleEvent(eventType, eventData, api) {
  for (const [name, eventModule] of global.client.events) {
    const targetEvents = eventModule.config.event_type;
    if (Array.isArray(targetEvents) && targetEvents.includes(eventType)) {
      try {
        if (typeof eventModule.run === "function") {
          eventModule.run({ api, event: eventData, eventType, Users, Threads });
        }
      } catch (err) {
        logger.log(`Lỗi khi xử lý event ${eventType} tại module ${name}: ${err.message}`, "error");
      }
    }
  }

  for (const [name, commandModule] of global.client.commands) {
    if (typeof commandModule.handleEvent === "function") {
      try {
        commandModule.handleEvent({ api, event: eventData, eventType, Users, Threads });
      } catch (err) {
        logger.log(`Lỗi khi xử lý handleEvent trong command ${name}: ${err.message}`, "error");
      }
    }
  }
}

module.exports = handleEvent;