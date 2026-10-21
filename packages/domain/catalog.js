// Fictional demo products. IDs and offer mappings are fixtures, never retailer SKUs.
export const catalog = [
  { id: 'milk', name: 'Молоко 3,2%', brand: 'Добрая ферма', size: '930 мл', category: 'Молочное', art: 'milk', color: '#e8eff6', identity: 'demo:milk:930ml:3.2', price: 10990 },
  { id: 'eggs', name: 'Яйца куриные С1', brand: 'Утро в деревне', size: '10 шт', category: 'Молочное', art: 'eggs', color: '#f2eadf', identity: 'demo:eggs:c1:10', price: 12990 },
  { id: 'bread', name: 'Хлеб зерновой', brand: 'Своя пекарня', size: '400 г', category: 'Хлеб и выпечка', art: 'bread', color: '#f5e9d5', identity: 'demo:bread:400g', price: 7990 },
  { id: 'tomato', name: 'Томаты на ветке', brand: 'Зелёная грядка', size: '500 г', category: 'Овощи и фрукты', art: 'tomato', color: '#f6e4df', identity: 'demo:tomato:500g', price: 18990 },
  { id: 'banana', name: 'Бананы', brand: 'Солнечный сад', size: '1 кг · упаковка', category: 'Овощи и фрукты', art: 'banana', color: '#f7f0d5', identity: 'demo:banana:1kg:pack', price: 14990 },
  { id: 'cheese', name: 'Сыр гауда 45%', brand: 'Добрая ферма', size: '200 г', category: 'Молочное', art: 'cheese', color: '#f7edd4', identity: 'demo:gouda:200g:45', price: 21990 },
  { id: 'pasta', name: 'Паста пенне', brand: 'Casa del Sole', size: '450 г', category: 'Бакалея', art: 'pasta', color: '#e9eddf', identity: 'demo:penne:450g', price: 10990 },
  { id: 'oats', name: 'Хлопья овсяные', brand: 'Доброе утро', size: '500 г', category: 'Бакалея', art: 'oats', color: '#eee5dc', identity: 'demo:oats:500g', price: 8990 },
  { id: 'coffee', name: 'Кофе молотый', brand: 'Тихое утро', size: '250 г', category: 'Напитки', art: 'coffee', color: '#e7e5df', identity: 'demo:coffee:250g', price: 44990 },
  { id: 'water', name: 'Вода без газа', brand: 'Чистый источник', size: '1,5 л', category: 'Напитки', art: 'water', color: '#e1eef0', identity: 'demo:water:1.5l', price: 5490 },
  { id: 'yogurt', name: 'Йогурт натуральный', brand: 'Добрая ферма', size: '150 г', category: 'Молочное', art: 'yogurt', color: '#ede7ef', identity: 'demo:yogurt:150g', price: 6990 },
  { id: 'apple', name: 'Яблоки зелёные', brand: 'Солнечный сад', size: '1 кг · упаковка', category: 'Овощи и фрукты', art: 'apple', color: '#e7eeda', identity: 'demo:apple:1kg:pack', price: 16990 }
];
export const regions = [
  { id: 'moscow-center', name: 'Москва, центр', deliveryExtra: 0 },
  { id: 'moscow-outer', name: 'Москва, за пределами ТТК', deliveryExtra: 7000 },
  { id: 'spb-center', name: 'Санкт-Петербург, центр', deliveryExtra: 3000 }
];
