import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PagedResult } from '../common/dto/pagination.dto';
import { BookPatchData, BooksRepository } from './books.repository';
import { BookEntity } from './dto/book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { ListBooksQueryDto } from './dto/list-books.query';
import { UpdateBookDto } from './dto/update-book.dto';

@Injectable()
export class BooksService {
  constructor(private readonly repo: BooksRepository) {}

  async create(dto: CreateBookDto): Promise<BookEntity> {
    const author = await this.repo.findAuthor(dto.authorId);
    if (!author) throw new NotFoundException('Author not found');
    return this.repo.create({
      title: dto.title,
      authorId: dto.authorId,
      isbn: dto.isbn,
      totalCopies: dto.totalCopies,
      availableCopies: dto.totalCopies,
    });
  }

  async findOne(id: string): Promise<BookEntity> {
    const b = await this.repo.findById(id);
    if (!b) throw new NotFoundException('Book not found');
    return b;
  }

  async findAll(q: ListBooksQueryDto): Promise<PagedResult<BookEntity>> {
    const { items, total } = await this.repo.findPaged(q.page, q.pageSize, q.authorId);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async update(id: string, dto: UpdateBookDto): Promise<BookEntity> {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundException('Book not found');

    const patch: BookPatchData = { ...dto };
    if (dto.totalCopies !== undefined) {
      const delta = dto.totalCopies - current.totalCopies;
      const newAvailable = current.availableCopies + delta;
      if (newAvailable < 0) {
        throw new BadRequestException(
          'totalCopies cannot be reduced below the number of copies currently in use',
        );
      }
      patch.availableCopies = newAvailable;
    }
    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundException('Book not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const active = await this.repo.countActiveReservations(id);
    if (active > 0) throw new ConflictException('Book has active reservations');
    await this.repo.delete(id);
  }
}
