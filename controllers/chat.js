const asyncHandler = require("express-async-handler")
const Chat = require("../models/chat")
const User = require("../models/user")
const Message = require("../models/message")
const { v4: uuidv4 } = require('uuid');


const fetchChats = asyncHandler(async (req, res) => {
    const curUserId = req.current.id;
    const chat = await Chat.find(
    { users: { $in: curUserId } }
    ).populate({
        path: "users",
        match: { _id: { $ne: curUserId } },
        select: "username profilepic"
    }).sort({ updateAt: -1 });
    
    if (chat == null) {
        return res.status(404).json({ msg: "No messages found" })
    }
 
    res.status(200).send({
        friends:chat
    })
})



const createChat = async (req, res) => {
    const curUser = req.current.id;
    const { chatName, members, isGroupChat, chatAdmin, status } = req.body;
 
    if (members.length==0 || isGroupChat.length==0 || !chatAdmin) {
        return res.status(400).send("Please fill the required fields")
    }
    if (chatName.length == 0 && isGroupChat == true) {
        return res.status(400).send("Chat name is required for group chat");
    }
    const users = [curUser, ...members];
    if (users.length < 2 && isGroupChat==true) {
        return res.status(400).send("More than 2 users are required to form a group chat")
    }

    if (isGroupChat == false) {   
        if (members.length > 1) {
            return res.status(400).json({ msg: "This is not a group chat.You cannot add more than one member" });
        }
        const isExist = await Chat.findOne({ users: { $all: [curUser, members[0]] },isGroupChat:false })
        if (isExist) {
            return res.status(400).json({msg: "Chat already exists"})
        }
    }
    let newGroupChat = {
        chatName: (isGroupChat==true?chatName:""),
        isGroupChat: isGroupChat,
        users: users,
        chatAdmin: chatAdmin,
        status: status
    };


    try {
        let createdChat = await Chat.create(newGroupChat);
        await Chat.populate(createdChat, { path: 'users', select: '-password' }); await Chat.populate(createdChat, { path: 'chatAdmin', select: '-password' });
        res.status(201).json({ "New group chat is added": createdChat });
    } catch (error) {
        console.error("Error creating group chat:", error);
        res.status(500).send("Internal server error");
    }
};

const addUserToGroup = async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).send("Please send user ID")
    }
    if (!req.body.link) {
        const chatId = req.params.chatId;
        if (!chatId) {
            return res.status(400).send("Please send the chat ID");
        }
        try {
            const chat = await Chat.findOne({ _id: chatId, isGroupChat: true });
            if (!chat) {
                return res.status(400).send("This chat does not exist or is not a group chat");
            }
            if (!chat.chatAdmin.includes(req.current.id)) {
                return res.status(401).send("Unauthorized access.You are not an admin in this group!")
            }
            // Filter out the userIds that already exist in the chat     
            const newUserIds = userId.filter(id => !chat.users.includes(id));

            if (newUserIds.length === 0) {
                return res.status(400).send("All users already exist in this chat");
            }
            //$each is used with $push to add each element in the object
            const updatedChat = await Chat.findOneAndUpdate(
                { _id: chatId },
                { $push: { users: { $each: newUserIds } } },
                { new: true }
            );

            res.status(200).json({ updatedChat: updatedChat });
        } catch (err) {
            console.error("Error adding user(s) to group chat:", err);
            res.status(500).send("Internal server error");
        }
    } else {
        const { link } = req.body;
        const chat = await Chat.findOne({ link: link });
        if (!chat) {
            return res.status(404).json({ msg: "Chat not found" });
        }
        const curDate = new Date();
        if (curDate > chat.expirationDate) {
            return res.status(400).json({ msg: "This link expired.Try to contact the admin of this group" });
        }
        const isAlreadyExist = chat.users.map(user => user.toString()).includes(userId.toString());
        if(!isAlreadyExist){
            chat.users.push(userId);
            await chat.save();
            res.status(200).json({ msg: "User is added successfully", chat: chat });
        } else {
            console.log("hello world")
            res.status(400).json({ msg: "You already exist in this group" });
        }
    }
};



const renameGroup = asyncHandler(async (req, res) => {
    const curUser = req.current.id;
    const chatId = req.params.chatId;
    const { updatedName } = req.body;
    if (!updatedName || !curUser || !chatId) {
        return res.status(400).send("Please fill all the required fields");
    }

    const isChatExist = await Chat.findOne(
        {_id:chatId}
    )
    if (isChatExist == null) {
        return res.status(400).send("Chat not found")
    }

    let chat = null;
    chat = await Chat.findOne(
        {
            _id: chatId,
            chatAdmin:{$in:curUser}          
        }
    )
    if (chat == null) {
        return res.status(401).send("Unauthorized access");
    }
    chat.chatName = updatedName
    await chat.save()
    res.status(200).json({ updatedchat:chat })


})


const removeFromChat = asyncHandler (async( req, res) => {
    const curUserId = req.current.id;
    const { deletedUserId, chatId } = req.body;
    if (!chatId || !deletedUserId) {
        return res.status(400).send("Chat id and user are required")
    }

    const isChatExist = await Chat.findOne(
    {_id:chatId , isGroupChat:true}
    )
    if (isChatExist == null) {
        return res.status(400).send("Chat not found")
    }

    const isMember = await Chat.findOne(
        {_id:chatId,users:{$in:deletedUserId}}
    )
    if (isMember == null) {
        return res.status(400).send("User not found")
    }


    let chat = await Chat.findOne(
        { _id: chatId, chatAdmin: { $in: curUserId } }       
    )
    if (chat == null) {
        return res.status(401).send("You are not an admin in this chat")
    }
     chat = await Chat.updateOne(
         { _id: chatId },
         {
             $pull: {
                 users: deletedUserId,
                 chatAdmin:deletedUserId
             }
         }
    )
    res.status(200).json({msg:"User was removed successfullt", chat: chat })

})


const exitChat = asyncHandler(async (req, res) => {
    const curUserId = req.current.id;
    const chatId = req.body.chatId
    if (!curUserId) {
        return res.status(400).send("user id is required");
    }

    const isChatExist = await Chat.findOne(
        {_id:chatId}
        )
        if (isChatExist == null) {
            return res.status(400).send("Chat not found")
        }

    const chat = await Chat.updateOne(
        { _id: chatId ,isGroupChat:true},
        {
        $pull: {
                users: curUserId,
                chatAdmin:curUserId
        }
         }
    )
    res.status(200).send("user has exited successfully")

})


const addAdmin = asyncHandler(async (req, res) => {
    const curUserId = req.current.id;
    const { userId } = req.params;
    const { chatId } = req.params;
    if (userId && curUserId && chatId) {
        const chat = await Chat.findOne({ _id: chatId ,isGroupChat:true});
        if (chat != null) {
            const isAdmin = chat.chatAdmin.includes(curUserId);
            if (isAdmin) {
                const isUserExist = chat.users.includes(userId);
                if (isUserExist) {
                    const isAdmin = chat.chatAdmin.includes(userId);
                    if (isAdmin) {
                        return res.status(400).json({ msg: "User is already an admin" });
                    } else {
                        chat.chatAdmin.push(userId);
                        await chat.save();
                        return res.status(200).json({ msg: "User is now an admin" });
                    }
                } else {
                    res.status(404).json({ msg: "User not found" });
                }
            } else {
                res.status(401).json({ msg: "Unauthorized access, you are not an admin!" });
            }
        } else {
            res.status(404).json({ msg: "Chat not found or it is not a group chat" });
        }
    } else {
        return res.status(400).json({ msg: "Please send all the required fields" });
    }
});

const createGroupLink = asyncHandler(async(req, res)=> {
    const curUserId = req.current.id;
    const { chatId } = req.params;
    if (!chatId) {
        return res.status(400).json({ msg: "Chat ID is required" });
    }
    const chat = await Chat.findOne({ _id: chatId });
    if (!chat) {
        return res.status(404).json({ msg: "Chat not found" });
    }
    const isGroup = chat.isGroupChat == true;
    if (!isGroup) {
        return res.status(400).json({ msg: "Not a group chat" });
    }
    const isAdmin = await chat.chatAdmin.includes(curUserId);
    if (isAdmin) {
        const randomBits = uuidv4();
        const link = `https://group-chat/${randomBits}`;
        const curDate = new Date();
        const { expirationDate } = req.body;
        let expireDate;
        if (expirationDate) {
            expireDate = new Date(expirationDate);
        } else {
            expireDate = new Date(curDate);
            expireDate.setMonth(expireDate.getMonth() + 3);
        }
        chat.link = link;
        chat.expirationDate = expireDate
        const updatedChat = await chat.save();
        res.status(201).json({msg:"Link created successfully",chat:updatedChat})
        
    } else {
        return res.status(401).json({ msg: "Not authorized" });
    }
})



module.exports = {
    fetchChats,
    createChat,
    addUserToGroup,
    renameGroup,
    removeFromChat,
    exitChat, 
    addAdmin,
    createGroupLink
}