require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require("jsonwebtoken");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.db_user}:${process.env.db_password}@cluster0.wxzkvmx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorize Access" });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, ACCESS_TOKEN, function (error, decoded) {
        if (error) {
            return res.status(401).send({ message: "Unauthorize Access" });
        }
        req.decoded = decoded;
        next();
    })
}


const run = async () => {
    try {
        const Categories = client.db("Library").collection("Category");
        const Users = client.db("Library").collection("User");
        app.get("/", async (req, res) => {

            res.send("Working");
        })

        app.get('/allCategory', async (req, res) => {
            const result = await Categories.find({}).toArray();
            res.send(result);
        })

        app.post("/register", async (req, res) => {
            const data = { ...req.body };
            const findEmail = await Users.findOne({ email: data.email });
            if (findEmail) {
                return res.send({ acknowledged: false });
            }
            else {
                const result = await Users.insertOne(data);
                res.send(result);
            }
        })

        app.get("/jwt", async (req, res) => {
            const email = req.query.user;
            const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "1h" });
            res.send({ token });
        })

        app.post("/login", async (req, res) => {
            const result = await Users.findOne({ $and: [{ email: req.body.email }, { password: req.body.password }] });
            return res.send(result);
        })

        app.post("/authSubscriberCheck", async (req, res) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.send({ user: false })
            }
            const token = authHeader.split(' ')[1];
            await jwt.verify(token, process.env.ACCESS_TOKEN, async function (error, decoded) {
                if (error) {
                    return res.send({ user: false });
                }
                const email = decoded.email;
                let result = await Users.findOne({ email: email });
                if (result) {
                    return res.send({ user: result })
                }
                else {
                    return res.send({ user: false });
                }
            })
        })
    }
    finally {

    }
}
run()
    .catch(error => {
        console.log(error.message);
    })


app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
})