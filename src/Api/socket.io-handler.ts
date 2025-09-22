// import { Socket, Server } from 'socket.io';
// import Logger from '../core/Logger';
// import { AccessService } from './Components/access/access.service';
// interface Message {
//   type: string
//   videoId: string
//   user_address: string
// }

// interface VideoMessage {
//   videoId: string
// }

// interface JoinChatMessage {
//   id: string
//   userId: string
// }

// interface SendChatMessage {
//   id: string
//   userId: string
//   message: string
// }

// // interface LobbySocket extends Socket {
// //   connectAt: Date
// //   user_address: string
// // }

// export class SocketEventHandlers {
//   private readonly _io: Server;
//   private readonly accessService = new AccessService()
//   public constructor(io: Server) {

//     this._io = io;

//     this._io.on('connection', (socket) => {

//       Logger.info(`Client connected: ${socket.id}`);
//       this.accessService.activeUser(socket?.handshake?.auth?.token)
//       //@ts-ignore
//       socket.connectAt = new Date()
//       //@ts-ignore
//       this.handleWatchEvent(socket)
//       this.handleCommentEvent(socket)
//       this.joinChatRoom(socket)
//       this.sendMessageOnChatRoom(socket)

//       socket.on('disconnect', () => {
//         this.accessService.inActiveUser(socket?.handshake?.auth?.token)
//         Logger.info(`Socket disconnected: ${socket.id}`);
//       });

//       socket.on('error', (error: Error) => {
//         this.accessService.inActiveUser(socket?.handshake?.auth?.token)
//         Logger.error(`Socket error: ${error.message}`);
//       });

//     });
//   }

//   /**
//    * Handle 'notification' event
//    *
//    * @param {Socket} socket Socket instance
//    */
//   public handleWatchEvent(socket: any) {

//     socket.on('JOIN_VIDEO_PAGE', (data: string) => {
//       console.log(data, typeof data);

//       const message: Message = JSON.parse(data);
//       socket.user_address = message.user_address;

//       Logger.info(`User Id: ${socket.id} Join Lobby: lobby-${message.videoId}`);

//       // Add the user to the lobby room
//       socket.join(`VIDEO-${message.videoId}`);

//       const response = {
//         type: "USER_WATCH_VIDEO",
//         message: `New user (${socket.id}) Join this vider (${message.videoId}) watch area`,
//         userId: socket.id,
//         user_address: socket.user_address
//       }

//       // Notify other users in the lobby that a new user has joined
//       socket.to(`VIDEO-${message.videoId}`).emit("USER_WATCH_VIDEO", response)

//     });

//     // socket.on('user_disconnect', (user: User) => {
//     //   Logger.info(`User disconnect ${user.id} (${user.email})`);

//     //   socket.leave("notification")
//     // });
//   }

//   public handleCommentEvent(socket: Socket) {

//     socket.on('WATCHING_VIDEO', (data: string) => {

//       const message: VideoMessage = JSON.parse(data);
//       // socket.riderId = message.riderId;

//       Logger.info(`Rider Id: ${message.videoId} Join ride waiting area: WAITING_FOR_RIDE`);

//       // Add the user to the lobby room
//       socket.join(`RIDE_WAITING_ROOM`);

//       const response = {
//         type: "NEW_RIDER_JOIN_WAITING_AREA",
//         userId: socket.id,
//         message: `New rider (${message.videoId}}) Join ride waiting area`,
//         params: {}
//       }

//       // Notify other users in the lobby that a new user has joined
//       socket.to(`VIDEO-${message.videoId}`).emit("NEW_RIDER_JOIN_WAITING_AREA", response)

//     })
//   }

//   public joinChatRoom(socket: Socket) {

//     socket.on('ONLINE', (data: string) => {
//       const message: JoinChatMessage = JSON.parse(data);

//       // @ts-ignore
//       socket.user_address = message.userId;
//       Logger.info(`User Id: ${socket.id} is Now Online At ${new Date()}`);

//       socket.join(`ONLINE`);

//       const response = {
//         type: "CHAT_ROOM_USERS",
//         message: `New user ${socket.id} Join chat room ${message.userId}`,
//         userId: socket.id,
//         // @ts-ignore
//         user_address: socket.user_address,
//         createdAt: new Date()
//       }

//       // Notify other users in the lobby that a new user has joined
//       socket.to(`ONLINE`).emit("CHAT_ROOM_USERS", response)
//     })

//     socket.on('JOIN_CHAT_ROOM', (data: string) => {

//       const message: JoinChatMessage = JSON.parse(data);

//       // @ts-ignore
//       socket.user_address = message.userId;

//       // console.log("message message message message message message message message",message)

//       // Logger.info(`User Id: ${socket.id} Join Chat Room: CHAT-${message.id}`);

//       socket.join(`CHAT-${message.id}`);

//       const response = {
//         type: "CHAT_ROOM_USERS",
//         message: `New user ${socket.id} Join chat room ${message.userId}`,
//         userId: socket.id,
//         // @ts-ignore
//         user_address: socket.user_address,
//         createdAt: new Date()
//       }

//       // Notify other users in the lobby that a new user has joined
//       socket.to(`CHAT-${message.id}`).emit("CHAT_ROOM_USERS", response)

//     });

//     socket.on('LEAVE_CHAT_ROOM', (data: string) => {

//       // Get a list of all rooms the socket is currently in
//       // @ts-ignore
//       const rooms = socket.adapter.rooms;
//       const rooms_iterator = rooms[Symbol.iterator]();

//       for (const iterator of rooms_iterator) {
//         const room_key = iterator[0];
//         console.log("room_key", room_key);
//         if (room_key.startsWith('CHAT-')) {
//           socket.leave(room_key);
//           Logger.info(`User Id: ${socket.id} Leave Chat Room: room-${room_key}`);
//         }
//       }
//     });
//   }

//   public sendMessageOnChatRoom(socket: any) {

//     socket.on('SEND_MESSAGE_ROOM', (data: string) => {
//       // console.log(data, typeof data);

//       const message: SendChatMessage = JSON.parse(data);
//       console.log('join mesaage join mesaage  join mesaage join mesaage', message)
//       socket.user_address = message.userId;

//       // Logger.info(`User Id: ${socket.id} send a message in chat room: CHAT-${message.id}`);

//       // Add the user to the lobby room
//       // socket.join(`CHAT-${message.id}`);

//       const response = {
//         type: "LISTEN_ROOM_MESSAGE",
//         id: '',
//         // message: `user (${socket.id}) send a message in chat room: CHAT-${message.message}`,
//         message: message.message,
//         conversationId: message.id,
//         //@ts-ignore
//         senderId: message.user,
//         createdAt: new Date()
//       }

//       // "id": "320def08-4322-4c7b-bb30-2765aef872ca",
//       // "message": "HARIS JA RAHA HAIIIIIIIIIIIII",
//       // "createdAt": "2023-04-18T06:36:38.463Z",
//       // "conversationId": "4ef0cb53-6538-4568-accc-b4e1d9ea61b5",
//       // "senderId": "83862720-2e07-404b-baf8-cb26f6ba43ce"

//       socket.emit("LISTEN_ROOM_MESSAGE", response)
//       // Notify other users in the lobby that a new user has joined
//       socket.to(`CHAT-${message.id}`).emit("LISTEN_ROOM_MESSAGE", response)

//     });



//     // userId: socket.id,
//     // user_address: socket.user_address,

//     // socket.on('user_disconnect', (user: User) => {
//     //   Logger.info(`User disconnect ${user.id} (${user.email})`);

//     //   socket.leave("notification")
//     // });
//   }

//   public oneToOneChat(socket: Socket) {

//     let users: any[] = [];
//     const addUser = (userId: any, socketId: any) => {
//       !users.some((user) => {
//         user.userId == userId;
//       });
//       users.push({ userId, socketId });
//     };
//     const removeUser = (socketId: any) => {
//       users = users.filter((user) => user.socketId !== socketId);
//     };
//     const getuser = (userId: any) => {
//       return users.find((user) => user.userId == userId);
//     };

//     socket.on("sendMessage", ({ senderId, receiverId, text }) => {
//       const user = getuser(receiverId);
//       this._io.to(user?.socketId).emit("getMessage", {

//         senderId,
//         text,
//       });
//     });
//     socket.on("disconnect", () => {
//       removeUser(socket.id);
//       this._io.emit("getusers", users);
//     });

//   }

// }