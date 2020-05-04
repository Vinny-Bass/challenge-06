import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  categoryName: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    categoryName,
  }: Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TransactionsRepository);

    if (type === 'outcome') {
      const balance = await transactionRepository.getBalance();

      if (value > balance.total) {
        throw new AppError(`Your balance is insufficient R$${balance.total}`);
      }
    }

    let category_id;
    const categoriesRepository = getRepository(Category);

    const catergoryExists = await categoriesRepository.findOne({
      where: { title: categoryName },
    });

    if (!catergoryExists) {
      const newCategory = categoriesRepository.create({
        title: categoryName,
      });
      await categoriesRepository.save(newCategory);
      category_id = newCategory.id;
    } else {
      category_id = catergoryExists.id;
    }

    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category_id,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
