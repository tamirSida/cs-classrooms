import { describe, expect, it } from "vitest";
import { HttpError, readJson } from "./http";

const request = (body: string) => new Request("http://test", { method: "POST", body });

describe("readJson", () => {
  it("parses a JSON object", async () => {
    await expect(readJson(request('{"a":1}'))).resolves.toEqual({ a: 1 });
  });

  it.each(["null", "[]", "3", "not json"])("rejects %s with a 400", async (body) => {
    await expect(readJson(request(body))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(request(body))).rejects.toBeInstanceOf(HttpError);
  });
});
