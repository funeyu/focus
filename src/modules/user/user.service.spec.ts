import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { User } from '../../models/entities';

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(UserService);
    jest.clearAllMocks();
  });

  it('should create a user and return it', async () => {
    const userData = { name: 'test', avatar: '', region: 'cn' };
    mockRepo.create.mockReturnValue({ id: 'usr_test', ...userData, vip: false });
    mockRepo.save.mockResolvedValue({ id: 'usr_test', ...userData, vip: false });

    const result = await service.create(userData);
    expect(result.name).toBe('test');
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should find a user by id', async () => {
    mockRepo.findOne.mockResolvedValue({ id: 'usr_test', name: 'test' });
    const result = await service.findById('usr_test');
    expect(result?.name).toBe('test');
  });
});