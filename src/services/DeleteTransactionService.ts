import { getRepository } from 'typeorm';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';

interface Request {
  id: string;
}

class DeleteTransactionService {
  public async execute({ id }: Request): Promise<void> {
    const deleteTransactionRepository = getRepository(Transaction);

    const transaction = await deleteTransactionRepository.findOne({
      where: { id },
    });

    if (!transaction) {
      throw new AppError('Transaction not exists');
    }

    await deleteTransactionRepository.remove(transaction);
  }
}

export default DeleteTransactionService;
