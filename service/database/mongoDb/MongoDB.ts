/**
 * This file allows the use of a single MongoDB connection throughout the backend.
 */

import { Db, MongoClient } from 'mongodb';
import dbUrl from '../../dbconfig';

let client: MongoClient | null = null;

export async function getDB(): Promise<Db> {
    if (!client) {
        client = new MongoClient(dbUrl, {
            // These are to handle temporary connection drops
            serverSelectionTimeoutMS: 5000, // 5 seconds timeout for initial connection
            socketTimeoutMS: 45000, // 45 seconds timeout for queries
            retryWrites: true, // Automatically retry failed writes
        });
        await client.connect();
        console.log("Connected to MongoDB");
    }
    return client.db('quikvote');
}

export async function closeDB(): Promise<void> {
    if (client) {
        await client.close();
        client = null;
        console.log("MongoDB connection closed");
    }
}
