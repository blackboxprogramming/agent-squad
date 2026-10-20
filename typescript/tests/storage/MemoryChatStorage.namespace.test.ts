import { strict as assert } from "node:assert";
import { InMemoryChatStorage } from "../../src/storage/memoryChatStorage";
import { ParticipantRole } from "../../src/types";

type IDs = [string, string, string];

describe("InMemoryChatStorage namespace isolation", () => {
  let storage: InMemoryChatStorage;

  beforeEach(() => {
    storage = new InMemoryChatStorage();
  });

  async function save(ids: IDs, text: string, role = ParticipantRole.USER) {
    return storage.saveChatMessage(...ids, { role, content: [{ text }] });
  }

  async function texts(ids: IDs) {
    return (await storage.fetchChat(...ids)).map(message => message.content?.[0]?.text);
  }

  test("user and session delimiters remain distinct", async () => {
    const first: IDs = ["owner#team", "session", "agent"];
    const second: IDs = ["owner", "team#session", "agent"];
    await save(first, "first");
    await save(second, "second");
    assert.deepEqual(await texts(first), ["first"]);
    assert.deepEqual(await texts(second), ["second"]);
  });

  test("session and agent delimiters remain distinct", async () => {
    const first: IDs = ["owner", "session#thread", "agent"];
    const second: IDs = ["owner", "session", "thread#agent"];
    await save(first, "first");
    await save(second, "second");
    assert.deepEqual(await texts(first), ["first"]);
    assert.deepEqual(await texts(second), ["second"]);
  });

  test("aggregate history preserves arbitrary identifiers", async () => {
    const ids: IDs = ['owner#雪"[]', 'session#💚\\route', 'agent#name"[]'];
    await save(ids, "question");
    await save(ids, "answer", ParticipantRole.ASSISTANT);
    const messages = await storage.fetchAllChats(ids[0], ids[1]);
    assert.deepEqual(
      messages.map(message => message.content?.[0]?.text),
      ["question", `[${ids[2]}] answer`]
    );
  });

  test("aggregate history excludes the other session", async () => {
    const first: IDs = ["owner#team", "session", "agent"];
    const second: IDs = ["owner", "team#session", "agent"];
    await save(first, "first");
    await save(second, "second");
    assert.deepEqual(
      (await storage.fetchAllChats(first[0], first[1])).map(message => message.content?.[0]?.text),
      ["first"]
    );
    assert.deepEqual(
      (await storage.fetchAllChats(second[0], second[1])).map(message => message.content?.[0]?.text),
      ["second"]
    );
  });

  test("same-role suppression stays local to the conversation", async () => {
    const first: IDs = ["owner#team", "session", "agent"];
    const second: IDs = ["owner", "team#session", "agent"];
    await save(first, "original");
    await save(first, "duplicate");
    await save(second, "independent");
    assert.deepEqual(await texts(first), ["original"]);
    assert.deepEqual(await texts(second), ["independent"]);
  });

  test("empty identifiers and unknown histories", async () => {
    const ids: IDs = ["", "#", ""];
    await save(ids, "retained");
    assert.deepEqual(await texts(ids), ["retained"]);
    assert.deepEqual(await texts(["#", "", ""]), []);
    assert.deepEqual(await storage.fetchAllChats("#", ""), []);
  });
});
