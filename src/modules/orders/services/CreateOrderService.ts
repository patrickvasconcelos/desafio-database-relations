import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Customer not found');
    }

    const productsExists = await this.productsRepository.findAllById(products);

    if (!productsExists.length) {
      throw new AppError('Products not found');
    }

    const produtsIdFound = productsExists.map(product => product.id);

    const inexistentsProducts = products.filter(
      product => !produtsIdFound.includes(product.id),
    );

    if (inexistentsProducts.length) {
      throw new AppError(`Product not exists ${inexistentsProducts[0].id}`);
    }

    const productsWithoutDisponibility = products.filter(
      product =>
        productsExists.filter(prod => prod.id === product.id)[0].quantity <
        product.quantity,
    );

    if (productsWithoutDisponibility.length) {
      throw new AppError(
        `The quantity ${productsWithoutDisponibility[0].quantity} of product ${productsWithoutDisponibility[0].id} is not available`,
      );
    }

    const productsFormatted = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsExists.filter(prod => prod.id === product.id)[0].price,
    }));

    const orders = await this.ordersRepository.create({
      customer: customerExists,
      products: productsFormatted,
    });

    const orderedProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        productsExists.filter(prod => prod.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return orders;
  }
}

export default CreateOrderService;
