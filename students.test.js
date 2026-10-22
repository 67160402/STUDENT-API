const request = require("supertest");
const app = require("./app");
const { generateToken } = require("./auth-helpers");

describe("GET /api/v1/students/:id", () => {
  const token = generateToken({
    id: 1,
    email: "student@example.com",
    role: "student",
  });

  test("ควรคืน 404 เมื่อไม่พบข้อมูลนักศึกษา", async () => {
    const response = await request(app)
      .get("/api/v1/students/9999")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  test("ควรคืน 200 พร้อมรายวิชาเมื่อ include=courses", async () => {
    const response = await request(app)
      .get("/api/v1/students/1?include=courses")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("id", 1);
    expect(response.body.data).toHaveProperty("courses");
    expect(Array.isArray(response.body.data.courses)).toBe(true);
  });
});
