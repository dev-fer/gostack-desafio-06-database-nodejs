import { getRepository, In } from 'typeorm';
import path from 'path';
import fs from 'fs';
import csvParse from 'csv-parse';

import uploadConfig from '../config/upload';
import AppError from '../errors/AppError';

import Category from '../models/Category';
import Transaction from '../models/Transaction';

interface Request {
  filename: string;
  mimetype: string;
}

interface TransactionRequest {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category_id: string;
}

class ImportTransactionsService {
  async execute({ filename, mimetype }: Request): Promise<Transaction[]> {
    const csvFilePath = path.join(uploadConfig.directory, filename);

    if (mimetype !== 'text/csv') {
      await fs.promises.unlink(csvFilePath);
      throw new AppError('File type shoud be csv.');
    }

    const readCSVStream = fs.createReadStream(csvFilePath);

    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const parseCSV = readCSVStream.pipe(parseStream);

    const transactionsListCSV: TransactionRequest[] = [];
    const categoriesListCSV: string[] = [];

    parseCSV.on('data', line => {
      const [title, type, value, category] = line;

      if (
        !title ||
        !type ||
        !value ||
        !['income', 'outcome'].includes(type) ||
        Number.isNaN(Number(value))
      )
        return;

      transactionsListCSV.push({ title, type, value, category_id: category });
      categoriesListCSV.push(category);
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    const uniqueCategories = Array.from(new Set(categoriesListCSV));

    const categoryRepository = getRepository(Category);

    const oldCategories = await categoryRepository.find({
      where: { title: In(uniqueCategories) },
    });

    const oldCategoriesTitle = oldCategories.map(category => category.title);

    const categoriesToCreate = uniqueCategories.filter(
      category => !oldCategoriesTitle.includes(category),
    );

    const newCategories = categoryRepository.create(
      categoriesToCreate.map(title => ({
        title,
      })),
    );

    await categoryRepository.save(newCategories);

    const allCategoriesList = [...oldCategories, ...newCategories];

    const transactionRepository = getRepository(Transaction);

    const newTransaction = transactionRepository.create(
      transactionsListCSV.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category_id: allCategoriesList.find(
          category => category.title === transaction.category_id,
        )?.id,
      })),
    );

    await transactionRepository.save(newTransaction);

    await fs.promises.unlink(csvFilePath);

    return newTransaction;
  }
}

export default ImportTransactionsService;
