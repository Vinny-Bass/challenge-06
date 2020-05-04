import fs from 'fs';
import path from 'path';
import csv from 'csv-parse';
import { getCustomRepository, getRepository, In } from 'typeorm';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import uploadConfig from '../config/upload';
import TransactionsRepository from '../repositories/TransactionsRepository';
import AppError from '../errors/AppError';

interface FileTransactions {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  async execute(fileUrl: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const filePath = path.join(uploadConfig.directory, fileUrl);
    const fileExists = fs.promises.stat(filePath);

    const transactions = [] as FileTransactions[];
    const categories = [] as string[];

    if (!fileExists) {
      throw new AppError('Cant find the file');
    }

    const parser = fs
      .createReadStream(filePath)
      .pipe(
        csv({
          columns: true,
          cast: true,
          trim: true,
        }),
      )
      .on('data', async ({ title, type, value, category }) => {
        if (!title || !type || !value) return;
        transactions.push({
          title,
          type,
          value,
          category,
        });
        categories.push(category);
      });

    await new Promise(resolve => parser.on('end', resolve));

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    const categoriesToAdd = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      categoriesToAdd.map(categoryName => {
        return {
          title: categoryName,
        };
      }),
    );

    await categoriesRepository.save(newCategories);

    const allCategories = [...newCategories, ...existentCategories];

    const newTransactions = transactionsRepository.create(
      transactions.map(transaction => {
        return {
          title: transaction.title,
          value: transaction.value,
          type: transaction.type,
          category: allCategories.find(category => {
            return category.title === transaction.category;
          }),
        };
      }),
    );

    await transactionsRepository.save(newTransactions);

    await fs.promises.unlink(filePath);

    return newTransactions;
  }
}

export default ImportTransactionsService;
