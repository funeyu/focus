import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FriendshipService } from './friendship.service';
import { Friendship } from '../../models/entities';

const mockRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};

describe('FriendshipService', () => {
  let service: FriendshipService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FriendshipService,
        { provide: getRepositoryToken(Friendship), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(FriendshipService);
    jest.clearAllMocks();
  });

  it('should create bidirectional friendship for passengers in same flight', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.save.mockResolvedValue({});

    await service.createForFlight('flight1', ['userA', 'userB']);

    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should not create duplicate friendship', async () => {
    mockRepo.findOne.mockResolvedValue({ id: 'existing' });

    await service.createForFlight('flight1', ['userA', 'userB']);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should get friends for a user', async () => {
    const friendships = [
      { id: 'frd_1', userIdA: 'userA', userIdB: 'userB', flightId: 'flight1' },
    ];
    mockRepo.find.mockResolvedValue(friendships);

    const result = await service.getFriends('userA');
    expect(result).toEqual(friendships);
  });
});