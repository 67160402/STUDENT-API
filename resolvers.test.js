const root = require("./resolvers");

describe("GraphQL Resolvers", () => {
  test("student ควรคืนข้อมูลนักศึกษาเมื่อพบ id", () => {
    const result = root.student({ id: 1 });

    expect(result).not.toBeNull();
    expect(result.id).toBe(1);
    expect(result.name).toBe("สมชาย ใจดี");
  });

  test("updateStudent ควรคืน null เมื่อไม่พบ id", () => {
    const result = root.updateStudent({
      id: 999,
      input: {
        name: "ไม่มีข้อมูล",
      },
    });

    expect(result).toBeNull();
  });
});
