const express = require("express");
const router = express.Router();

const pool = require("../db");
const { redisClient } = require("../cache");

let students = [
  {
    id: 1,
    name: "สมชาย ใจดี",
    major: "วิทยาการคอมพิวเตอร์",
    email: "somchai@example.com",
    phone: "080-000-0001",
    courseIds: [101, 102],
  },
  {
    id: 2,
    name: "สมหญิง รักเรียน",
    major: "เทคโนโลยีสารสนเทศ",
    email: "somying@example.com",
    phone: "080-000-0002",
    courseIds: [102],
  },
];

let courses = [
  { id: 101, courseName: "การเขียนโปรแกรมเบื้องต้น", credit: 3 },
  { id: 102, courseName: "โครงสร้างข้อมูล", credit: 3 },
];

let nextId = 3;

// 1. GET ดึงรายการนักศึกษาทั้งหมด
const { parsePagination, parseSort } = require("../middlewares/query-parser");

router.get("/", parsePagination, parseSort, async (req, res, next) => {
  const { major } = req.query;
  const { page, limit, offset } = req.pagination;
  const { field, order } = req.sort;

  let baseQuery = "SELECT * FROM students";
  let countQuery = "SELECT COUNT(*) AS total FROM students";
  const params = [];

  if (major) {
    baseQuery += " WHERE major = ?";
    countQuery += " WHERE major = ?";
    params.push(major);
  }

  // แทรก field/order ลง SQL ได้โดยตรงเฉพาะเพราะผ่าน allowlist ใน parseSort มาแล้ว
  // ห้ามนำรูปแบบนี้ไปใช้กับค่าจาก req อื่นที่ไม่ได้ผ่าน allowlist
  baseQuery += ` ORDER BY ${field} ${order} LIMIT ? OFFSET ?`;

  try {
    const [rows] = await pool.query(baseQuery, [...params, limit, offset]);
    const [[{ total }]] = await pool.query(countQuery, params);

    res.status(200).json({
      message: "สำเร็จ",
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// 2. GET ดึงข้อมูลนักศึกษารายบุคคลตาม id

// GET คืนข้อมูลนักศึกษาพร้อมรายวิชาที่ลงทะเบียน
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "ไม่พบข้อมูลนักศึกษา",
      },
    });
  }

  const shouldIncludeCourses = req.query.include === "courses";

  if (shouldIncludeCourses) {
    const studentCourses = courses.filter((c) =>
      student.courseIds.includes(c.id),
    );

    return res.status(200).json({
      message: "สำเร็จ",
      data: { ...student, courses: studentCourses },
    });
  }

  res.status(200).json({
    message: "สำเร็จ",
    data: student,
  });
});

// 3. POST เพิ่มข้อมูลนักศึกษาใหม่
router.post("/", async (req, res, next) => {
  const { name, major, email } = req.body;

  if (!name || !major || !email) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ name, major และ email ให้ครบถ้วน",
      },
    });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO students (name, major, email) VALUES (?, ?, ?)",
      [name, major, email],
    );

    await redisClient.del("students:all");

    res.status(201).json({
      message: "เพิ่มข้อมูลสำเร็จ",
      data: {
        id: result.insertId,
        name,
        major,
        email,
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

// 4. PUT แก้ไขข้อมูลนักศึกษาทั้งระเบียน
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, major } = req.body;
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      message: "ไม่พบข้อมูลนักศึกษา",
    });
  }

  if (!name || !major) {
    return res.status(400).json({
      message: "กรุณาระบุ name และ major ให้ครบถ้วน",
    });
  }

  student.name = name;
  student.major = major;

  res.status(200).json({
    message: "แก้ไขข้อมูลสำเร็จ",
    data: student,
  });
});

// ADD. PATCH แก้ไขข้อมูลนักศึกษาบางส่วน
router.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "ไม่พบข้อมูลนักศึกษา",
      },
    });
  }

  // อัปเดตเฉพาะฟิลด์ที่ส่งมา ฟิลด์อื่นคงค่าเดิมไว้
  const { name, major, email } = req.body;

  if (name !== undefined) student.name = name;
  if (major !== undefined) student.major = major;
  if (email !== undefined) student.email = email;

  res.status(200).json({
    message: "แก้ไขข้อมูลสำเร็จ",
    data: student,
  });
});

// 5. DELETE ลบข้อมูลนักศึกษา ย้ายไป index.js เพื่อให้สามารถใช้ middleware ตรวจสอบสิทธิ์ก่อนลบได้

module.exports = router;
