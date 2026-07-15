import express, { Request, Response } from "express";
import { MongoClient, ObjectId, Collection, Db } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI as string;
const client = new MongoClient(uri);

let db: Db;
let productsCollection: Collection<Product>;

interface Product {
  _id?: ObjectId;
  title: string;
  description: string;
  price: number;
  category: "Laptops" | "Monitors" | "Accessories" | "Mobile" | "Keyboard" | "PS-5" | "Headphone" | "Gaming Gear" | "Speaker" | "TV" | "AC";
  image: string;
  condition: "Like New" | "Excellent" | "Good" | "Fair";
  sellerEmail: string;
  createdAt: Date;
}

async function connectDB() {
  try {
    await client.connect();
    db = client.db("ReTechDB");
    productsCollection = db.collection<Product>("products");
    console.log("Connected MongoDB Successfully!");
  } catch (error) {
    console.error("Database connection failed:", error);
  }
}

connectDB();

/************ All Api Routes **************/

// 1. GET /products (Fetch all with Category, Price Filtering, Search, Sorting & Pagination)
app.get("/products", async (req: Request, res: Response) => {
  try {
    const { search, category, maxPrice, sortBy, page, limit } = req.query;
    let query: any = {};

    if (search && typeof search === "string") {
      query.title = { $regex: search, $options: "i" };
    }

    if (category && typeof category === "string") {
      query.category = category;
    }

    if (maxPrice) {
      query.price = { $lte: Number(maxPrice) };
    }

    let sortOptions: any = { createdAt: -1 };
    if (sortBy && typeof sortBy === "string") {
      if (sortBy === "priceLowHigh") {
        sortOptions = { price: 1 };
      } else if (sortBy === "priceHighLow") {
        sortOptions = { price: -1 };
      } else if (sortBy === "oldest") {
        sortOptions = { createdAt: 1 };
      }
    }

    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 8;
    const skip = (currentPage - 1) * currentLimit;

    const products = await productsCollection
      .find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(currentLimit)
      .toArray();

    const totalItems = await productsCollection.countDocuments(query);
    const totalPages = Math.ceil(totalItems / currentLimit);

    res.status(200).json({
      meta: {
        totalItems,
        totalPages,
        currentPage,
        limit: currentLimit
      },
      data: products
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error });
  }
});

// 2. GET /products/latest (Home page latest 4 gadgets)
app.get("/products/latest", async (req: Request, res: Response) => {
  try {
    const latestProducts = await productsCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(4)
      .toArray(); 

    return res.status(200).json(latestProducts);
  } catch (error) {
    console.error("Error fetching latest additions:", error);
    return res.status(500).json({ message: "Failed to fetch latest additions" });
  }
});

// 3. GET /products/my-items
app.get("/products/my-items", async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        message: "A valid seller email is required as a query parameter"
      });
    }

    const myProducts = await productsCollection.find({ sellerEmail: email }).toArray();
    res.status(200).json(myProducts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user inventory", error });
  }
});

// 4. GET /products/:id (Get single product details)
app.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Product ID" });
    }

    const product = await productsCollection.findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: "Error fetching product details", error });
  }
});

// 5. POST /products (Add a new gadget)
app.post("/products", async (req: Request, res: Response) => {
  try {
    const { title, description, price, category, image, condition, sellerEmail } = req.body;

    if (!title || !price || !category || !image || !condition || !sellerEmail) {
      return res.status(400).json({ message: "Missing required product fields" });
    }

    const newProduct: Product = {
      title,
      description,
      price: Number(price),
      category,
      image,
      condition,
      sellerEmail,
      createdAt: new Date(),
    };

    const result = await productsCollection.insertOne(newProduct);
    res.status(201).json({
      message: "Product listed successfully",
      id: result.insertedId
    });
  } catch (error) {
    res.status(500).json({ message: "Error listing product", error });
  }
});

// 6. DELETE /products/:id (Delete a listed item)
app.delete("/products/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Product ID" });
    }

    const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Product not found or already deleted" });
    }
    res.status(200).json({
      message: "Product deleted successfully from inventory"
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error });
  }
});

app.listen(PORT, () => {
  console.log(`Backend Running on port ${PORT}`);
});