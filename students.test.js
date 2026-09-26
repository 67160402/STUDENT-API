const request = require("supertest");
const app = require("./app");

describe("GET /api/v1/students/:id", () => {
  test("ควรคืน 404 เมื่อไม่พบข้อมูลนักศึกษา", async () => {
    const response = await request(app).get("/api/v1/students/9999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  test("ควรคืน 200 พร้อมรายวิชาเมื่อ include=courses", async () => {
    const response = await request(app).get(
      "/api/v1/students/1?include=courses",
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("id", 1);
    expect(response.body.data).toHaveProperty("courses");
    expect(Array.isArray(response.body.data.courses)).toBe(true);
  });
});
