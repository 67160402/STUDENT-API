const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const { graphqlHTTP } = require("express-graphql");

const pool = require("./db");
const schema = require("./schema");
const root = require("./resolvers");

const studentsRouter = require("./routes/students");

const {
  hashPassword,
  verifyPassword,
  generateToken,
} = require("./auth-helpers");

const { authenticateToken, authorizeRole } = require("./middlewares/auth");

const app = express();

// Middleware
app.use(helmet());

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

// GraphQL
app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
  }),
);

// หน้าแรก
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Student API พร้อมใช้งานแล้ว",
  });
});

// API v1
const v1Router = express.Router();

// Routes นักศึกษา
v1Router.use("/students", studentsRouter);

// ลงทะเบียนรายวิชา
v1Router.post("/students/:id/enrollments", async (req, res, next) => {
  const studentId = req.params.id;
  const { courseId } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [courseRows] = await connection.query(
      "SELECT * FROM courses WHERE id = ? FOR UPDATE",
      [courseId],
    );

    if (courseRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        error: {
          code: "COURSE_NOT_FOUND",
          message: "ไม่พบรายวิชาที่ระบุ",
        },
      });
    }

    if (courseRows[0].seat_available <= 0) {
      await connection.rollback();

      return res.status(409).json({
        error: {
          code: "SEAT_FULL",
          message: "ที่นั่งเต็มแล้ว",
        },
      });
    }

    await connection.query(
      "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
      [studentId, courseId],
    );

    await connection.query(
      "UPDATE courses SET seat_available = seat_available - 1 WHERE id = ?",
      [courseId],
    );

    await connection.commit();

    res.status(201).json({
      message: "ลงทะเบียนสำเร็จ",
    });
  } catch (err) {
    await connection.rollback();

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "ALREADY_ENROLLED",
          message: "นิสิตลงทะเบียนรายวิชานี้ไปแล้ว",
        },
      });
    }

    next(err);
  } finally {
    connection.release();
  }
});

// สมัครสมาชิก
v1Router.post("/auth/register", async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ email และ password",
      },
    });
  }

  try {
    const passwordHash = await hashPassword(password);

    const [result] = await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'student')",
      [email, passwordHash],
    );

    res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ",
      data: {
        id: result.insertId,
        email,
        role: "student",
      },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "DUPLICATE_EMAIL",
          message: "อีเมลนี้มีอยู่ในระบบแล้ว",
        },
      });
    }

    next(err);
  }
});

// Login
v1Router.post("/auth/login", async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ email และ password",
      },
    });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        },
      });
    }

    const user = rows[0];

    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        },
      });
    }

    const token = generateToken(user);

    res.status(200).json({
      message: "เข้าสู่ระบบสำเร็จ",
      token,
    });
  } catch (err) {
    next(err);
  }
});

// ตรวจสอบข้อมูลผู้ใช้จาก Token
v1Router.get("/auth/me", authenticateToken, (req, res) => {
  res.status(200).json({
    message: "สำเร็จ",
    data: req.user,
  });
});

// DELETE นักศึกษา - เฉพาะ admin
v1Router.delete(
  "/students/:id",
  authenticateToken,
  authorizeRole("admin"),
  async (req, res, next) => {
    try {
      const [result] = await pool.query("DELETE FROM students WHERE id = ?", [
        req.params.id,
      ]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบข้อมูลนิสิต",
          },
        });
      }

      res.status(200).json({
        message: "ลบข้อมูลสำเร็จ",
      });
    } catch (err) {
      next(err);
    }
  },
);

// ใช้ prefix /api/v1 กับทุก route ด้านบน
app.use("/api/v1", v1Router);

// API v2
const v2Router = express.Router();

v2Router.get("/students", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students");

    res.status(200).json({
      items: rows,
      count: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

app.use("/api/v2", v2Router);

// 404
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "ไม่พบเส้นทางที่ร้องขอ",
    },
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : err.type || "ERROR",
      message:
        statusCode === 500
          ? "เกิดข้อผิดพลาดที่ไม่คาดคิดภายในระบบ"
          : err.message,
    },
  });
});

module.exports = app;
