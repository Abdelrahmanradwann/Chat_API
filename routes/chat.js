const router = require("express").Router()
const chatController = require("../controllers/chat")
const verify = require("../Middleware/verifyToken")



router.get("/users", verify.verifyToken, chatController.fetchChats)

router.post("/chat", verify.verifyToken, chatController.createChat)

router.post("/chat/add/group/:chatId", verify.verifyToken, chatController.addUserToGroup)

router.post("/chat/rename/:chatId", verify.verifyToken, chatController.renameGroup)

router.post("/chat/remove", verify.verifyToken, chatController.removeFromChat)

router.post("/chat/exit", verify.verifyToken, chatController.exitChat)

router.put("/chat/admin/:userId/:chatId", verify.verifyToken, chatController.addAdmin)

router.post("/chat/create-link/:chatId",verify.verifyToken,chatController.createGroupLink)

module.exports = router