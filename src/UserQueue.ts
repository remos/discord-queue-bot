import {User} from 'discord.js';

export class UserQueue {
    users: User[];
    length: number;

    constructor() {
        this.users = [];
        this.length = 0;
    }

    join(joiner: string): string {
        return this.users.join(joiner);
    }

    get(index: number): User {
        return this.users[index];
    }

    indexOf(user: User): number {
        return this.users.findIndex(testUser=>user.id === testUser.id);
    }

    remove(user: User): User {
        const index = this.indexOf(user);
        if(index < 0) {
            return;
        }

        this.users.splice(index, 1);
        this.length = this.users.length;

        return user;
    }

    has(user: User): boolean {
        return this.indexOf(user) >= 0;
    }

    push(user: User): void {
        this.users.push(user);
        this.length = this.users.length;
    }

    shift(): User {
        const user = this.users.shift();
        this.length = this.users.length;
        return user;
    }

    unshift(user: User): void {
        this.users.unshift(user);
        this.length = this.users.length;
    }

    map<T>(callbackFn: (user: User) => T): T[] {
        return this.users.map(callbackFn);
    }

    concat(...queues: (UserQueue | User[] | any[])[]): User[] {
        return this.users.concat(...queues.map((queue: UserQueue | User[])=>queue instanceof UserQueue ? queue.users : queue));
    }
}