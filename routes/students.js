const express = require("express");
const router = express.Router();

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
router.get("/", (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: students });
});

// 2. GET ดึงข้อมูลนักศึกษารายบุคคลตาม id
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }

  res.status(200).json({ message: "สำเร็จ", data: student });
});

// 3. POST เพิ่มข้อมูลนักศึกษาใหม่
router.post("/", (req, res) => {
  const { name, major } = req.body;

  if (!name || !major) {
    return res
      .status(400)
      .json({ message: "กรุณาระบุ name และ major ให้ครบถ้วน" });
  }

  const newStudent = { id: nextId++, name, major };
  students.push(newStudent);

  res.status(201).json({ message: "เพิ่มข้อมูลสำเร็จ", data: newStudent });
});

// 4. PUT แก้ไขข้อมูลนักศึกษาทั้งระเบียน
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, major } = req.body;
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }

  if (!name || !major) {
    return res
      .status(400)
      .json({ message: "กรุณาระบุ name และ major ให้ครบถ้วน" });
  }

  student.name = name;
  student.major = major;

  res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: student });
});

// 5. DELETE ลบข้อมูลนักศึกษา
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = students.findIndex((s) => s.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }

  students.splice(index, 1);

  res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
});

// GET คืนข้อมูลนักศึกษาพร้อมรายวิชาที่ลงทะเบียน
router.get("/:id/full", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }

  const studentCourses = courses.filter((c) =>
    student.courseIds.includes(c.id),
  );

  res.status(200).json({
    message: "สำเร็จ",
    data: { ...student, courses: studentCourses },
  });
});

module.exports = router;
