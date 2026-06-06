import { Repository } from 'typeorm';
import { User } from '../../models/entities';
export declare class UserService {
    private readonly userRepo;
    constructor(userRepo: Repository<User>);
    create(data: Partial<User>): Promise<User>;
    findById(id: string): Promise<User | null>;
    findByIds(ids: string[]): Promise<User[]>;
}
