import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchBooksQueryDto } from './dto/search-books.query';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get('books')
  searchBooks(@Query() q: SearchBooksQueryDto) {
    return this.svc.searchBooks(q);
  }
}
