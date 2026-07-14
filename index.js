const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const studentRoutes = require("./routes/students");
const { graphqlHTTP } = require("express-graphql");
const schema = require("./schema");
const root = require("./resolvers");

app.use(express.json());

app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true, // เปิดใช้งานหน้าทดสอบ GraphiQL ผ่านเบราว์เซอร์
  }),
);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Student API พร้อมใช้งานแล้ว" });
});

app.use("/api/v1/students", studentRoutes);

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`);
});
