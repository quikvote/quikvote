export interface RoomDAO {
    createRoom: (creatorUsername: string) => any,
    getRoomByCode: (roomCode: string) => any,
    getRoomById: (roomId: string) => any,
    addParticipantToRoom: (roomCode: string, username: string) => any,
    addOptionToRoom: (roomId: string, option: string) => any,
    submitUserVotes: (roomId: string, username: string, votes: any) => any,
    closeRoom: (roomId: string) => any,
    deleteRoom: (roomId: string) => any
}