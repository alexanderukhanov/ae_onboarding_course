import { Injectable } from '@nestjs/common';
import { PagedResult } from '../common/dto/pagination.dto';
import { BookWithScoreEntity } from './dto/book-with-score.entity';
import { SearchBooksQueryDto } from './dto/search-books.query';
import { SearchRepository } from './search.repository';

@Injectable()
export class SearchService {
  constructor(private readonly repo: SearchRepository) {}

  async searchBooks(q: SearchBooksQueryDto): Promise<PagedResult<BookWithScoreEntity>> {
    const { items, total } = await this.repo.searchBooks({
      q: q.q,
      authorId: q.authorId ?? null,
      page: q.page,
      pageSize: q.pageSize,
    });
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
}
