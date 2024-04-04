const Message = require("../models/message")
const Chat = require("../models/chat")
const asyncHandler = require("express-async-handler")
// SENDING
// GET ALL MESSAGES
// READ BY


const sendMessage = ( async (req, res) => {
    //senderID
    //chatID
    //content

    const curUserId = req.current.id;
    const { chatId } = req.params;
    const { content } = req.body;
    try {
        const checkChat = await Chat.findOne({ _id: chatId })
        if (checkChat == null) {
            return res.status(400).send("This is not a chat")
        }
        if (content.length == 0) {
            return res.status(400).send("Message is required")
        }
        const message = new Message({
        sender: curUserId,
        chatId: chatId,
        content: content,
        readBy: [],
        chat:chatId
    
    })
        try {
            await message.save();
            res.status(200).send("Message was sent successfully");
        } catch (err) {
            throw new Error(err)
        }
    } catch (err) {
        console.log("wtffff")
        res.StatusCode = 400;
        throw new Error(err)
    }
    

})

const getMessage = async (req, res) => {
    const chatId = req.params.chatId;
    try {
        const chat = await Chat.findOne(
            { _id: chatId }
        )
        if (chat.length == 0) {
            return res.status(400).send("Chat not found");
        }

        const messages = await Message.find({ chat: chatId }).sort({ createdAt: -1 });
        res.status(200).send({chatInfo: chat, history:messages })
    }
    catch (err) {
        res.statusCode = 400
        throw new Error(err);
    }

}

const updatereadBy = async (req, res) => {
    const { messageId } = req.body;
    const curUserId = req.current.id;
    try {
    const result = await Message.updateMany(
        { _id:messageId, readBy: { $ne: curUserId } },
        { $push: { readBy: curUserId } }        
        );
        
        res.status(200).send("User had read the message without errors")
    } catch (error) {
        throw new Error(error);
    }
}

module.exports = {
    sendMessage,
    getMessage,
    updatereadBy
}