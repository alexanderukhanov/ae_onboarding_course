import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BookPatchData, BooksRepository, BookWriteData } from './books.repository';
import { BooksService } from './books.service';
import { BookEntity } from './dto/book.entity';

function book(overrides: Partial<BookEntity> = {}): BookEntity {
  return {
    id: 'b1',
    title: 'T',
    authorId: 'a1',
    isbn: '9780132350884',
    totalCopies: 5,
    availableCopies: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(): jest.Mocked<BooksRepository> {
  return {
    findById: jest.fn<(id: string) => Promise<BookEntity | undefined>>(),
    findAuthor: jest.fn<(id: string) => Promise<{ id: string } | undefined>>(),
    findPaged: jest.fn<
      (p: number, ps: number, a?: string) => Promise<{ items: BookEntity[]; total: number }>
    >(),
    create: jest.fn<(data: BookWriteData) => Promise<BookEntity>>(),
    update: jest.fn<(id: string, data: BookPatchData) => Promise<BookEntity | undefined>>(),
    delete: jest.fn<(id: string) => Promise<void>>(),
    countActiveReservations: jest.fn<(id: string) => Promise<number>>(),
  } as unknown as jest.Mocked<BooksRepository>;
}

describe('BooksService', () => {
  let repo: jest.Mocked<BooksRepository>;
  let svc: BooksService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new BooksService(repo);
  });

  it('creates a book with availableCopies = totalCopies', async () => {
    repo.findAuthor.mockResolvedValue({ id: 'a1' });
    repo.create.mockImplementation((data) =>
      Promise.resolve(book({ ...data, id: 'b1' })),
    );
    const out = await svc.create({
      title: 'T',
      authorId: 'a1',
      isbn: '9780132350884',
      totalCopies: 3,
    });
    expect(out.availableCopies).toBe(3);
    expect(repo.create).toHaveBeenCalledWith({
      title: 'T',
      authorId: 'a1',
      isbn: '9780132350884',
      totalCopies: 3,
      availableCopies: 3,
    });
  });

  it('rejects create when author does not exist', async () => {
    repo.findAuthor.mockResolvedValue(undefined);
    await expect(
      svc.create({ title: 'T', authorId: 'a1', isbn: '9780132350884', totalCopies: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 on unknown id', async () => {
    repo.findById.mockResolvedValue(undefined);
    await expect(svc.findOne('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects totalCopies update that would drive availableCopies negative', async () => {
    repo.findById.mockResolvedValue(book({ totalCopies: 5, availableCopies: 1 }));
    // 4 copies are in use; new totalCopies=3 would leave -1 available
    await expect(svc.update('b1', { totalCopies: 3 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies delta to availableCopies when increasing totalCopies', async () => {
    repo.findById.mockResolvedValue(book({ totalCopies: 5, availableCopies: 2 }));
    repo.update.mockResolvedValue(book({ totalCopies: 7, availableCopies: 4 }));
    const out = await svc.update('b1', { totalCopies: 7 });
    expect(out.totalCopies).toBe(7);
    expect(out.availableCopies).toBe(4);
    expect(repo.update).toHaveBeenCalledWith('b1', { totalCopies: 7, availableCopies: 4 });
  });

  it('refuses to delete a book with non-terminal reservations', async () => {
    repo.findById.mockResolvedValue(book());
    repo.countActiveReservations.mockResolvedValue(1);
    await expect(svc.remove('b1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
