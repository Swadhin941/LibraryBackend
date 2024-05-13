require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const SSLCommerzPayment = require("sslcommerz-lts");
const store_id = process.env.storeId;
const store_passwd = process.env.storePasswd;
const is_live = false;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.db_user}:${process.env.db_password}@cluster0.wxzkvmx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorize Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {
    if (error) {
      return res.status(401).send({ message: "Unauthorize Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const run = async () => {
  try {
    const Categories = client.db("Library").collection("Category");
    const Users = client.db("Library").collection("User");
    const AllBooks = client.db("Library").collection("AllBooks");
    const WishList = client.db("Library").collection("WishList");
    const Cart = client.db("Library").collection("Cart");
    const Orders = client.db("Library").collection("Orders");
    const AllBlogs = client.db("Library").collection("AllBlogs");

    app.get("/", async (req, res) => {
      res.send("Working");
    });

    app.get("/allCategory", async (req, res) => {
      const result = await Categories.find({}).toArray();
      res.send(result);
    });

    app.post("/register", async (req, res) => {
      const data = { ...req.body };
      const findEmail = await Users.findOne({ email: data.email });
      if (findEmail) {
        return res.send({ acknowledged: false });
      } else {
        const result = await Users.insertOne(data);
        res.send(result);
      }
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.user;
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    app.post("/login", async (req, res) => {
      const result = await Users.findOne({
        $and: [{ email: req.body.email }, { password: req.body.password }],
      });
      return res.send(result);
    });

    app.put('/updateUser', verifyJWT, async(req, res)=>{
      const filter = {email: req.query.user};
      const updatedDoc= {
        $set: {
          img: req.body.img
        }
      };
      const option= {upsert: true};
      const result = await Users.updateOne(filter, updatedDoc, option);
      res.send(result);
    })

    app.get("/allActivity", verifyJWT, async(req, res)=>{
      const result = await Orders.find({email: req.query.user}).toArray();
      res.send(result);
    })

    app.post("/authSubscriberCheck", async (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.send({ user: false });
      }
      const token = authHeader.split(" ")[1];
      await jwt.verify(
        token,
        process.env.ACCESS_TOKEN,
        async function (error, decoded) {
          if (error) {
            return res.send({ user: false });
          }
          const email = decoded.email;
          let result = await Users.findOne({ email: email });
          if (result) {
            return res.send({ user: result });
          } else {
            return res.send({ user: false });
          }
        }
      );
    });

    app.post("/uploadBook", verifyJWT, async (req, res) => {
      const data = { ...req.body };
      const getAllBooks = await AllBooks.findOne({ isbn: req.body.isbn });
      if (getAllBooks) {
        return res.send({
          acknowledged: false,
          message: "Book already exists",
        });
      } else {
        const result = await AllBooks.insertOne(data);
        return res.send(result);
      }
    });

    app.post("/addToCart", verifyJWT, async (req, res) => {
      const result = await Cart.insertOne({ ...req.body });
      res.send(result);
    });

    app.post("/removeFromCart", verifyJWT, async (req, res) => {
      const result = await Cart.deleteOne({
        $and: [{ email: req.query.user }, { bookId: req.body.bookId }],
      });
      res.send(result);
    });

    app.get("/allCartData", verifyJWT, async (req, res) => {
      const result = await Cart.find({ email: req.query.user }).toArray();
      res.send(result);
    });

    app.put("/increCart", verifyJWT, async (req, res) => {
      // console.log(req.body);
      const data = { ...req.body };
      const id = data._id;
      delete data._id;
      data.quantity = data?.quantity + 1;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          ...data,
        },
      };
      const option = { upsert: true };
      const result = await Cart.updateOne(filter, updatedDoc, option);
      res.send(result);
    });

    app.put(`/decreCart`, verifyJWT, async (req, res) => {
      const data = { ...req.body };
      const id = data._id;
      delete data._id;
      data.quantity = data?.quantity - 1;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          ...data,
        },
      };
      const option = { upsert: true };
      const result = await Cart.updateOne(filter, updatedDoc, option);
      res.send(result);
    });

    app.delete("/deleteFromCart", verifyJWT, async (req, res) => {
      const result = await Cart.deleteOne({
        $and: [{ email: req.query.user }, { _id: new ObjectId(req.body.id) }],
      });
      res.send(result);
    });

    app.post("/payment-init", verifyJWT, async (req, res) => {
      const trxID = new ObjectId().toString();
      const data = {
        total_amount: req.body.totalAmount,
        currency: "BDT",
        tran_id: trxID, // use unique tran_id for each api call
        success_url: `http://localhost:5000/payment/success/${trxID}`,
        fail_url: `http://localhost:5000/payment/error/${trxID}`,
        cancel_url: `http://localhost:5000/payment/error/${trxID}`,
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: "Customer Name",
        cus_email: "customer@example.com",
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then(async (apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        const orderPost = await Orders.insertOne({
          ...req.body,
          time: Date.now(),
          localeTime: new Date().toLocaleTimeString(),
          localDate: new Date().toLocaleDateString(),
          transactionId: trxID,
          paid: false,
        });
        res.send({ url: GatewayPageURL });
        // console.log("Redirecting to: ", GatewayPageURL);
      });
    });

    app.post("/payment/success/:trxid", async (req, res) => {
      const transactionId = req.params.trxid;
      const findTrx = await Orders.findOne({ transactionId: transactionId });
      if (findTrx) {
        const filter = { transactionId: transactionId };
        const updatedDoc = {
          $set: {
            paid: true,
          },
        };
        const option = { upsert: true };
        const result = await Orders.updateOne(filter, updatedDoc, option);
        const deleteCart = await Cart.deleteMany({ email: findTrx?.email });
        if (deleteCart?.deletedCount > 0) {
          findTrx?.products.forEach(async(element)=>{
            const getBook = await AllBooks.findOne({_id: new ObjectId(element?.bookId)})
            if(getBook){
              const quantities= Math.abs(parseInt(getBook?.quantities)-element?.quantity);
              const filter = {_id: new ObjectId(getBook?._id.toString())};
              const updatedDoc= {
                $set: {
                  quantities:quantities
                }
              };
              const option = {upsert: true};
              const updateBook = await AllBooks.updateOne(filter, updatedDoc, option);
            }
          })
          return res.redirect(`http://localhost:3000/cart`);
        }
      } else {
      }
    });

    app.post("/payment/error/:trxid", async (req, res) => {
      const transactionId = req.params.trxid;
      const result = await Orders.deleteOne({ transactionId: transactionId });
      res.redirect(`http://localhost:3000/cart`);
    });

    app.get("/specific-category/:name", async (req, res) => {
      // console.log(req.params.name);
      const category = req.params.name;
      const result = await AllBooks.find({ category: category }).toArray();
      res.send(result);
    });

    app.get("/bookDetails/:id", async (req, res) => {
      const email = req.query.user;
      let availability;
      let cartAvailability;
      if (email) {
        availability = await WishList.findOne({
          $and: [{ email: email }, { bookId: req.params.id }],
        });
        cartAvailability = await Cart.findOne({
          $and: [{ email: email }, { bookId: req.params.id }],
        });
      }
      let getBook = await AllBooks.findOne({
        _id: new ObjectId(req.params.id),
      });
      getBook = {
        ...getBook,
        wishlist: availability ? true : false,
        cartChecked: cartAvailability ? true : false,
      };
      res.send(getBook);
    });

    app.patch("/updateBook", async (req, res) => {
      const data = { ...req.body };
      delete data._id;
      const filter = {
        _id: new ObjectId(req.body._id),
      };
      const updatedDoc = {
        $set: {
          ...data,
        },
      };
      const option = { upsert: true };
      const result = await AllBooks.updateOne(filter, updatedDoc, option);
      res.send(result);
    });

    app.delete("/deleteBook", verifyJWT, async (req, res) => {
      const deleteFromWishList = await WishList.deleteMany({
        bookId: req.query.id,
      });
      const deleteFromCart = await Cart.deleteMany({ bookId: req.query.id });
      const deleteBook = await AllBooks.deleteOne({
        _id: new ObjectId(req.query.id),
      });
      res.send(deleteBook);
    });

    app.post("/add-to-wish", verifyJWT, async (req, res) => {
      let data = { ...req.body, email: req.query.user, bookId: req.body._id };
      delete data._id;
      const result = await WishList.insertOne({ ...data });
      res.send(result);
    });

    app.post("/delete-wish", verifyJWT, async (req, res) => {
      // console.log(req.body, req.query.user);
      const result = await WishList.deleteOne({
        bookId: req.body._id,
        email: req.query.user,
      });
      res.send(result);
    });

    app.get("/wishlist", verifyJWT, async (req, res) => {
      // console.log(req.query.user);
      const result = await WishList.find({ email: req.query.user }).toArray();
      res.send(result);
    });

    app.get('/allBlog', async(req, res)=>{
      const result = await AllBlogs.find({}).toArray();
      res.send(result);
    })

    app.post('/blogPost', verifyJWT, async(req, res)=>{
      const result = await AllBlogs.insertOne({...req.body})
      res.send(result);
    })

    app.get('/blog/:id', async(req, res)=>{
      const result = await AllBlogs.findOne({_id: new ObjectId(req.params.id)})
      res.send(result);
    })

  } finally {
  }
};
run().catch((error) => {
  console.log(error.message);
});

app.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});
