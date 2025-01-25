require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fmfzj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("LifeStreamDB").collection("users");

    // Users api
    app.post("/users", async (req, res) => {
      const data = req.body;
      const result = await userCollection.insertOne(data);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const { group, district, upazila } = req.query;
      const role = "donor";
      const query = {};
      if (group && district && upazila) {
        query.blood_group = group;
        query.district = district;
        query.upazila = upazila;
      }

      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/user", async (req, res) => {
      const { email } = req.query;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const updateInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: updateInfo.name,
          email: updateInfo.email,
          image: updateInfo.image,
          blood_group: updateInfo.blood_group,
          district: updateInfo.district,
          upazila: updateInfo.upazila,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Life Stream is running");
});
app.listen(port, () => {
  console.log(`Life Stream is running on port ${port}`);
});
