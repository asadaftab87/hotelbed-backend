import { Socket, Server } from 'socket.io';
import Logger from '../core/Logger';

interface Message {
  type: string
  videoId: string
  user_address: string
}

interface VideoMessage {
  videoId: string
}

// interface UserMessage {
//   id: string
//   userId: string
// }

// interface RideAcceptMessage {
//   rideId: string
//   riderId: string
// }

// interface LobbySocket extends Socket {
//   connectAt: Date
//   user_address: string
// }

export class SocketEventHandlers {
  private readonly _io: Server;

  public constructor(io: Server) {

    this._io = io;
    // this._io= new Server({
    //   cors: {
    //     origin: "http://localhost:4200/",
    //     methods: ["GET", "POST"]
    //   }
    // });
    this._io.on('connection', (socket) => {

      Logger.info(`Client connected: ${socket.id}`);
      //@ts-ignore
      socket.connectAt = new Date()
      //@ts-ignore
      this.handleWatchEvent(socket)
      this.handleCommentEvent(socket)

      // setInterval(() => {
      //     this.handleRoomIntervel(socket)
      // }, 10000)

      socket.on('disconnect', () => {
        Logger.info(`Socket disconnected: ${socket.id}`);
      });

      socket.on('error', (error: Error) => {
        Logger.error(`Socket error: ${error.message}`);
      });

    });
  }

  /**
   * Handle 'notification' event
   *
   * @param {Socket} socket Socket instance
   */
  public handleWatchEvent(socket: any) {

    socket.on('JOIN_VIDEO_PAGE', (data: string) => {
      console.log(data, typeof data);

      const message: Message = JSON.parse(data);
      socket.user_address = message.user_address;

      Logger.info(`User Id: ${socket.id} Join Lobby: lobby-${message.videoId}`);

      // Add the user to the lobby room
      socket.join(`VIDEO-${message.videoId}`);

      const response = {
        type: "USER_WATCH_VIDEO",
        message: `New user (${socket.id}) Join this vider (${message.videoId}) watch area`,
        userId: socket.id,
        user_address: socket.user_address
      }

      // Notify other users in the lobby that a new user has joined
      socket.to(`VIDEO-${message.videoId}`).emit("USER_WATCH_VIDEO", response)

    });

    // socket.on('user_disconnect', (user: User) => {
    //   Logger.info(`User disconnect ${user.id} (${user.email})`);

    //   socket.leave("notification")
    // });
  }

  public handleCommentEvent(socket: Socket) {

    socket.on('WATCHING_VIDEO', (data: string) => {

      const message: VideoMessage = JSON.parse(data);
      // socket.riderId = message.riderId;

      Logger.info(`Rider Id: ${message.videoId} Join ride waiting area: WAITING_FOR_RIDE`);

      // Add the user to the lobby room
      socket.join(`RIDE_WAITING_ROOM`);

      const response = {
        type: "NEW_RIDER_JOIN_WAITING_AREA",
        userId: socket.id,
        message: `New rider (${message.videoId}}) Join ride waiting area`,
        params: {}
      }

      // Notify other users in the lobby that a new user has joined
      socket.to(`VIDEO-${message.videoId}`).emit("NEW_RIDER_JOIN_WAITING_AREA", response)

    })
  }

  public oneToOneChat(socket: Socket) {

    let users: any[] = [];
    const addUser = (userId: any, socketId: any) => {
      !users.some((user) => {
        user.userId == userId;
      });
      users.push({ userId, socketId });
    };
    const removeUser = (socketId: any) => {
      users = users.filter((user) => user.socketId !== socketId);
    };
    const getuser = (userId: any) => {
      return users.find((user) => user.userId == userId);
    };

    socket.on("sendMessage", ({ senderId, receiverId, text }) => {
      const user = getuser(receiverId);
      this._io.to(user?.socketId).emit("getMessage", {
      
        senderId,
        text,
      });
    });
    socket.on("disconnect", () => {
      removeUser(socket.id);
      this._io.emit("getusers", users);
    });

  }

}