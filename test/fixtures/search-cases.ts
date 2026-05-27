export interface SeedBook {
  title: string;
  authorName: string;
  isbn: string;
  totalCopies: number;
}

export const CASE_1_BOOKS: SeedBook[] = [
  { title: 'Clean Code',      authorName: 'Robert C. Martin', isbn: '9780132350884', totalCopies: 1 },
  { title: 'The Clean Coder', authorName: 'Robert C. Martin', isbn: '9780137081073', totalCopies: 1 },
  { title: 'Code Complete',   authorName: 'Steve McConnell',   isbn: '9780735619678', totalCopies: 1 },
];

export const CASE_3_BOOKS: SeedBook[] = [
  { title: 'Refactoring', authorName: 'Martin Fowler', isbn: '9780134757599', totalCopies: 1 },
];

export const CASE_4_BOOKS: SeedBook[] = [
  { title: 'Domain-Driven Design', authorName: 'Eric Evans', isbn: '9780321125217', totalCopies: 1 },
];

export const CASE_5_BOOKS: SeedBook[] = [
  { title: 'Patterns', authorName: 'Author A', isbn: '9780000000001', totalCopies: 1 },
  { title: 'Patterns', authorName: 'Author B', isbn: '9780000000002', totalCopies: 1 },
];
