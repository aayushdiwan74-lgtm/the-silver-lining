
export interface Item {
  id: string;
  name: string;
  price: number;
  quantity: number;
  discount: number; // Percentage discount per item
}

export interface Invoice {
  storeName: string;
  customerPhone: string;
  items: Item[];
  discount: number;
  currency: string;
}

export interface ExtractionResult {
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
}
