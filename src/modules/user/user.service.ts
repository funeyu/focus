import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../models/entities';
import { IdUtil } from '../../common/id.util';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create({
      id: IdUtil.next('user'),
      name: data.name || '',
      avatar: data.avatar || '',
      vip: false,
      region: data.region || '',
    });
    return this.userRepo.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return this.userRepo.findByIds(ids);
  }

}