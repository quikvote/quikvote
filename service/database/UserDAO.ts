import { User } from "../model";

export interface UserDAO {
    getUser: (username: string) => Promise<User | null>,
    getUserByToken: (token: string) => Promise<User | null>,
    createUser: (username: string, password: string, nickname: string|null) => Promise<User>,
}
