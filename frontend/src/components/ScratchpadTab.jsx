import React from "react";
import { Box, Divider, HStack, IconButton, Select, Tooltip } from "@chakra-ui/react";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useSession } from "../context/SessionContext";
import {
  LuBold,
  LuCode,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuHeading4,
  LuItalic,
  LuStrikethrough,
} from "react-icons/lu";

const ScratchpadTab = () => {
  const { sessionId: contextSessionId, setSessionId, scratchpadText, setScratchpadText } = useSession();
  const scratchpadTypingTimeoutRef = React.useRef(null);
  const isApplyingExternalUpdateRef = React.useRef(false);

  const getEditorMarkupFromText = React.useCallback((value) => {
    const escaped = String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return escaped
      .split("\n")
      .map((line) => `<p>${line || "<br />"}</p>`)
      .join("");
  }, []);

  const handleScratchpadChange = React.useCallback(
    async (newText) => {
      setScratchpadText(newText);

      if (scratchpadTypingTimeoutRef.current) {
        clearTimeout(scratchpadTypingTimeoutRef.current);
        scratchpadTypingTimeoutRef.current = null;
      }

      if (String(newText || "").trim()) {
        scratchpadTypingTimeoutRef.current = setTimeout(() => {
          try {
            window.dispatchEvent(
              new CustomEvent("scratchpad_typing_stopped", {
                detail: { workspace: newText },
              }),
            );
          } catch (err) {
            console.error("Failed to dispatch scratchpad_typing_stopped event:", err);
          }
        }, 2000);
      }

      if (!contextSessionId && newText.length > 0) {
        try {
          const newSessionId = await window.sessionApi.createSession({
            metadata: {
              userAgent: navigator.userAgent,
              deviceType: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? "mobile" : "desktop",
            },
          });
          setSessionId(newSessionId);
          await window.sessionApi.addScratchpadSnapshot(newSessionId, newText);
        } catch (err) {
          console.error("Failed to create session and save initial scratchpad snapshot:", err);
        }
      }
    },
    [contextSessionId, setScratchpadText, setSessionId],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Subscript,
      Superscript,
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      TextStyleKit,
    ],
    content: getEditorMarkupFromText(scratchpadText),
    shouldRerenderOnTransaction: true,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      if (isApplyingExternalUpdateRef.current) return;
      void handleScratchpadChange(currentEditor.getText());
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const editorText = editor.getText();
    if (editorText === scratchpadText) return;

    isApplyingExternalUpdateRef.current = true;
    editor.commands.setContent(getEditorMarkupFromText(scratchpadText), false);
    isApplyingExternalUpdateRef.current = false;
  }, [editor, getEditorMarkupFromText, scratchpadText]);

  React.useEffect(() => {
    return () => {
      if (scratchpadTypingTimeoutRef.current) {
        clearTimeout(scratchpadTypingTimeoutRef.current);
      }
    };
  }, []);

  if (!editor) return null;

  const run = (fn) => () => fn(editor.chain().focus()).run();
  const isHeadingActive = (level) => editor.isActive("heading", { level });

  return (
    <Box display="flex" flexDirection="column" height="100%" overflow="hidden">
      <Box flex="1" minHeight={0} overflow="auto" px={5} py={5}>
        <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" bg="white" height="100%" display="flex" flexDirection="column">
          <HStack p={2} spacing={2} borderBottomWidth="1px" borderColor="gray.100" wrap="wrap">
            <Select
              size="sm"
              w="120px"
              value={editor.getAttributes("textStyle")?.fontFamily || "default"}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "default") editor.chain().focus().unsetFontFamily().run();
                else editor.chain().focus().setFontFamily(value).run();
              }}
            >
              <option value="default">Default</option>
              <option value="serif">Serif</option>
              <option value="mono">Monospace</option>
              <option value="cursive">Cursive</option>
            </Select>

            <Select
              size="sm"
              w="90px"
              value={editor.getAttributes("textStyle")?.fontSize || "14px"}
              onChange={(e) => {
                editor.chain().focus().setMark("textStyle", { fontSize: e.target.value }).run();
              }}
            >
              <option value="12px">12px</option>
              <option value="14px">14px</option>
              <option value="16px">16px</option>
              <option value="18px">18px</option>
            </Select>

            <Divider orientation="vertical" h="24px" />

            <Tooltip label="Bold">
              <IconButton size="sm" aria-label="Bold" icon={<LuBold />} variant={editor.isActive("bold") ? "solid" : "ghost"} onClick={run((c) => c.toggleBold())} />
            </Tooltip>
            <Tooltip label="Italic">
              <IconButton size="sm" aria-label="Italic" icon={<LuItalic />} variant={editor.isActive("italic") ? "solid" : "ghost"} onClick={run((c) => c.toggleItalic())} />
            </Tooltip>
            <Tooltip label="Strikethrough">
              <IconButton
                size="sm"
                aria-label="Strikethrough"
                icon={<LuStrikethrough />}
                variant={editor.isActive("strike") ? "solid" : "ghost"}
                onClick={run((c) => c.toggleStrike())}
              />
            </Tooltip>
            <Tooltip label="Code">
              <IconButton size="sm" aria-label="Code" icon={<LuCode />} variant={editor.isActive("code") ? "solid" : "ghost"} onClick={run((c) => c.toggleCode())} />
            </Tooltip>

            <Divider orientation="vertical" h="24px" />

            <Tooltip label="H1">
              <IconButton
                size="sm"
                aria-label="Heading 1"
                icon={<LuHeading1 />}
                variant={isHeadingActive(1) ? "solid" : "ghost"}
                onClick={run((c) => c.toggleHeading({ level: 1 }))}
              />
            </Tooltip>
            <Tooltip label="H2">
              <IconButton
                size="sm"
                aria-label="Heading 2"
                icon={<LuHeading2 />}
                variant={isHeadingActive(2) ? "solid" : "ghost"}
                onClick={run((c) => c.toggleHeading({ level: 2 }))}
              />
            </Tooltip>
            <Tooltip label="H3">
              <IconButton
                size="sm"
                aria-label="Heading 3"
                icon={<LuHeading3 />}
                variant={isHeadingActive(3) ? "solid" : "ghost"}
                onClick={run((c) => c.toggleHeading({ level: 3 }))}
              />
            </Tooltip>
            <Tooltip label="H4">
              <IconButton
                size="sm"
                aria-label="Heading 4"
                icon={<LuHeading4 />}
                variant={isHeadingActive(4) ? "solid" : "ghost"}
                onClick={run((c) => c.toggleHeading({ level: 4 }))}
              />
            </Tooltip>
          </HStack>

          <Box
            flex="1"
            minH={0}
            overflowY="auto"
            px={4}
            py={3}
            sx={{
              ".ProseMirror": {
                outline: "none",
                minHeight: "100%",
              },
              ".ProseMirror > * + *": { marginTop: "0.75em" },
              ".ProseMirror h1": { fontSize: "2xl", fontWeight: 700 },
              ".ProseMirror h2": { fontSize: "xl", fontWeight: 700 },
              ".ProseMirror h3": { fontSize: "lg", fontWeight: 700 },
              ".ProseMirror h4": { fontSize: "md", fontWeight: 700 },
              ".ProseMirror p.is-editor-empty:first-of-type::before": {
                content: '"Start typing here..."',
                color: "#9CA3AF",
                pointerEvents: "none",
                float: "left",
                height: 0,
              },
            }}
          >
            <EditorContent editor={editor} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ScratchpadTab;

