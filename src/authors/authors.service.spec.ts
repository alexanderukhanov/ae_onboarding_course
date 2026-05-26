import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuthorsRepository } from './authors.repository';
import { AuthorsService } from './authors.service';
import { AuthorEntity } from './dto/author.entity';

function makeRepo(): jest.Mocked<AuthorsRepository> {
  return {
    findById: jest.fn<(id: string) => Promise<AuthorEntity | undefined>>(),
    findPaged: jest.fn<
      (page: number, pageSize: number) => Promise<{ items: AuthorEntity[]; total: number }>
    >(),
    create: jest.fn<(data: { name: string }) => Promise<AuthorEntity>>(),
    update: jest.fn<(id: string, data: { name?: string }) => Promise<AuthorEntity | undefined>>(),
    delete: jest.fn<(id: string) => Promise<void>>(),
    countBooksByAuthor: jest.fn<(id: string) => Promise<number>>(),
  } as unknown as jest.Mocked<AuthorsRepository>;
}

describe('AuthorsService', () => {
  let repo: jest.Mocked<AuthorsRepository>;
  let svc: AuthorsService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new AuthorsService(repo);
  });

  it('creates an author', async () => {
    repo.create.mockResolvedValue({ id: 'a1', name: 'X', createdAt: new Date() });
    const out = await svc.create({ name: 'X' });
    expect(out.name).toBe('X');
    expect(repo.create).toHaveBeenCalledWith({ name: 'X' });
  });

  it('returns 404 when getting an unknown author', async () => {
    repo.findById.mockResolvedValue(undefined);
    await expect(svc.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists authors with pagination', async () => {
    repo.findPaged.mockResolvedValue({
      items: [{ id: '1', name: 'A', createdAt: new Date() }],
      total: 1,
    });
    const out = await svc.findAll({ page: 1, pageSize: 20 });
    expect(out.total).toBe(1);
    expect(out.items).toHaveLength(1);
  });

  it('refuses to delete an author with books', async () => {
    repo.findById.mockResolvedValue({ id: 'a1', name: 'X', createdAt: new Date() });
    repo.countBooksByAuthor.mockResolvedValue(2);
    await expect(svc.remove('a1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes an author with no books', async () => {
    repo.findById.mockResolvedValue({ id: 'a1', name: 'X', createdAt: new Date() });
    repo.countBooksByAuthor.mockResolvedValue(0);
    await svc.remove('a1');
    expect(repo.delete).toHaveBeenCalledWith('a1');
  });
});
