import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult, PaginationQueryDto } from '../common/dto/pagination.dto';
import { AuthorsRepository } from './authors.repository';
import { AuthorEntity } from './dto/author.entity';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';

@Injectable()
export class AuthorsService {
  constructor(private readonly repo: AuthorsRepository) {}

  async create(dto: CreateAuthorDto): Promise<AuthorEntity> {
    return this.repo.create({ name: dto.name });
  }

  async findOne(id: string): Promise<AuthorEntity> {
    const a = await this.repo.findById(id);
    if (!a) throw new NotFoundException('Author not found');
    return a;
  }

  async findAll(q: PaginationQueryDto): Promise<PagedResult<AuthorEntity>> {
    const { items, total } = await this.repo.findPaged(q.page, q.pageSize);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async update(id: string, dto: UpdateAuthorDto): Promise<AuthorEntity> {
    await this.findOne(id);
    const updated = await this.repo.update(id, dto);
    if (!updated) throw new NotFoundException('Author not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const books = await this.repo.countBooksByAuthor(id);
    if (books > 0) throw new ConflictException('Author has books');
    await this.repo.delete(id);
  }
}
