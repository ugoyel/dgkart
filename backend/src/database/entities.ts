import { ImageMapping } from '../modules/admin/image-mapping.entity';
import { ImportJob } from '../modules/admin/import-job.entity';
import { CartItem } from '../modules/cart/cart-item.entity';
import { Category } from '../modules/catalog/category.entity';
import { ProductImage } from '../modules/catalog/product-image.entity';
import { Product } from '../modules/catalog/product.entity';
import { Order } from '../modules/orders/order.entity';
import { User } from '../modules/users/user.entity';
import { WatchItem } from '../modules/watchlist/watch-item.entity';

export const ENTITIES = [User, Category, Product, ProductImage, CartItem, WatchItem, Order, ImportJob, ImageMapping];
