export interface UserDAO {
    getUser: (username: string) => any,
    getUserByToken: (token: string) => any,
    createUser: (username: string, password: string) => any,
}