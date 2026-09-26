jest.mock("./db");

const request = require("supertest");
const app = require("./app");
const pool = require("./db");
const { generateToken, hashPassword } = require("./auth-helpers");

describe("App Coverage Tests", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. Register: ไม่มี email และ password
  test("POST /api/v1/auth/register ควรคืน 400 เมื่อไม่มีข้อมูล", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  // 2. Login: ไม่มี email และ password
  test("POST /api/v1/auth/login ควรคืน 400 เมื่อไม่มีข้อมูล", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  // 3. Login: password ผิด
  test("POST /api/v1/auth/login ควรคืน 401 เมื่อ password ไม่ถูกต้อง", async () => {
    const hashedPassword = await hashPassword("CorrectPassword");

    pool.query.mockResolvedValueOnce([
      [
        {
          id: 1,
          email: "wrongpass@example.com",
          password_hash: hashedPassword,
          role: "student",
        },
      ],
    ]);

    const response = await request(app).post("/api/v1/auth/login").send({
      email: "wrongpass@example.com",
      password: "WrongPassword",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  // 4. auth/me: token ไม่ถูกต้อง
  test("GET /api/v1/auth/me ควรคืน 401 เมื่อ token ไม่ถูกต้อง", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid.token.here");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_TOKEN");
  });

  // 5. DELETE: student ไม่มีสิทธิ์ admin
  test("DELETE /api/v1/students/:id ควรคืน 403 เมื่อ role เป็น student", async () => {
    const token = generateToken({
      id: 1,
      email: "student@example.com",
      role: "student",
    });

    const response = await request(app)
      .delete("/api/v1/students/1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  // 6. DELETE: admin แต่ไม่พบข้อมูล
  test("DELETE /api/v1/students/:id ควรคืน 404 เมื่อไม่พบข้อมูล", async () => {
    const token = generateToken({
      id: 99,
      email: "admin@example.com",
      role: "admin",
    });

    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const response = await request(app)
      .delete("/api/v1/students/9999")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  // 7. DELETE: admin ลบข้อมูลสำเร็จ
  test("DELETE /api/v1/students/:id ควรคืน 200 เมื่อ admin ลบสำเร็จ", async () => {
    const token = generateToken({
      id: 99,
      email: "admin2@example.com",
      role: "admin",
    });

    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(app)
      .delete("/api/v1/students/1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("ลบข้อมูลสำเร็จ");
  });

  // 8. Route ที่ไม่มีอยู่
  test("ควรคืน 404 เมื่อเรียก route ที่ไม่มีอยู่", async () => {
    const response = await request(app).get("/this-route-does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  // 9. Error Handler: database error ใน DELETE
  test("DELETE /api/v1/students/:id ควรคืน 500 เมื่อ database error", async () => {
    const token = generateToken({
      id: 100,
      email: "admin3@example.com",
      role: "admin",
    });

    pool.query.mockRejectedValueOnce(new Error("Database connection lost"));

    const response = await request(app)
      .delete("/api/v1/students/1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  // 10. Enrollment: ไม่พบรายวิชา
  test("POST /api/v1/students/:id/enrollments ควรคืน 404 เมื่อไม่พบรายวิชา", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      query: jest.fn().mockResolvedValueOnce([[]]),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 9999 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("COURSE_NOT_FOUND");
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  // 11. Enrollment: ที่นั่งเต็ม
  test("POST /api/v1/students/:id/enrollments ควรคืน 409 เมื่อที่นั่งเต็ม", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      query: jest.fn().mockResolvedValueOnce([
        [
          {
            id: 101,
            seat_available: 0,
          },
        ],
      ]),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 101 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SEAT_FULL");
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  // 12. Enrollment: ลงทะเบียนสำเร็จ
  test("POST /api/v1/students/:id/enrollments ควรคืน 201 เมื่อลงทะเบียนสำเร็จ", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      query: jest
        .fn()
        .mockResolvedValueOnce([
          [
            {
              id: 101,
              seat_available: 10,
            },
          ],
        ])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 101 });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("ลงทะเบียนสำเร็จ");
    expect(connection.beginTransaction).toHaveBeenCalled();
    expect(connection.commit).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  // 13. API v2: database error
  test("GET /api/v2/students ควรคืน 500 เมื่อ database error", async () => {
    pool.query.mockRejectedValueOnce(new Error("Database error"));

    const response = await request(app).get("/api/v2/students");

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

afterAll(async () => {
  await pool.end();
});
