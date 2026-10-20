"""Namespace regression checks shared in behavior with the TypeScript storage tests."""

import unittest

from agent_squad.storage import InMemoryChatStorage
from agent_squad.types import ConversationMessage


class ChatNamespaceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.storage = InMemoryChatStorage()

    async def save(self, ids, text, role="user"):
        return await self.storage.save_chat_message(
            *ids, ConversationMessage(role=role, content=[{"text": text}])
        )

    async def texts(self, ids):
        return [message.content[0]["text"] for message in await self.storage.fetch_chat(*ids)]

    async def test_user_and_session_delimiters_remain_distinct(self):
        first = ("owner#team", "session", "agent")
        second = ("owner", "team#session", "agent")
        await self.save(first, "first")
        await self.save(second, "second")
        self.assertEqual(await self.texts(first), ["first"])
        self.assertEqual(await self.texts(second), ["second"])

    async def test_session_and_agent_delimiters_remain_distinct(self):
        first = ("owner", "session#thread", "agent")
        second = ("owner", "session", "thread#agent")
        await self.save(first, "first")
        await self.save(second, "second")
        self.assertEqual(await self.texts(first), ["first"])
        self.assertEqual(await self.texts(second), ["second"])

    async def test_aggregate_history_preserves_arbitrary_identifiers(self):
        ids = ('owner#雪"[]', 'session#💚\\route', 'agent#name"[]')
        await self.save(ids, "question")
        await self.save(ids, "answer", role="assistant")
        messages = await self.storage.fetch_all_chats(ids[0], ids[1])
        self.assertEqual(
            [message.content[0]["text"] for message in messages],
            ["question", f"[{ids[2]}] answer"],
        )

    async def test_aggregate_history_excludes_the_other_session(self):
        first = ("owner#team", "session", "agent")
        second = ("owner", "team#session", "agent")
        await self.save(first, "first")
        await self.save(second, "second")
        self.assertEqual(
            [m.content[0]["text"] for m in await self.storage.fetch_all_chats(*first[:2])],
            ["first"],
        )
        self.assertEqual(
            [m.content[0]["text"] for m in await self.storage.fetch_all_chats(*second[:2])],
            ["second"],
        )

    async def test_same_role_suppression_stays_local_to_the_conversation(self):
        first = ("owner#team", "session", "agent")
        second = ("owner", "team#session", "agent")
        await self.save(first, "original")
        await self.save(first, "duplicate")
        await self.save(second, "independent")
        self.assertEqual(await self.texts(first), ["original"])
        self.assertEqual(await self.texts(second), ["independent"])

    async def test_empty_identifiers_and_unknown_histories(self):
        ids = ("", "#", "")
        await self.save(ids, "retained")
        self.assertEqual(await self.texts(ids), ["retained"])
        self.assertEqual(await self.texts(("#", "", "")), [])
        self.assertEqual(await self.storage.fetch_all_chats("#", ""), [])


if __name__ == "__main__":
    unittest.main()
