import { useRef, useState, useCallback } from "react";
import ImageUpload from "./components/ImageUpload";
import CodePreview from "./components/CodePreview";
import Preview from "./components/Preview";
import { CodeGenerationParams, generateCode } from "./generateCode";
import Spinner from "./components/Spinner";
import classNames from "classnames";
import {
  FaCode,
  FaCopy,
  FaDesktop,
  FaDownload,
  FaMobile,
  FaUndo,
} from "react-icons/fa";

import { Switch } from "./components/ui/switch";
import copy from "copy-to-clipboard";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import CodeMirror from "./components/CodeMirror";
import SettingsDialog from "./components/SettingsDialog";
import { Settings, EditorTheme, AppState } from "./types";
import { IS_RUNNING_ON_CLOUD } from "./config";
import { PicoBadge } from "./components/PicoBadge";
import { OnboardingNote } from "./components/OnboardingNote";
import { usePersistedState } from "./hooks/usePersistedState";
import { UrlInputSection } from "./components/UrlInputSection";
import TermsOfServiceDialog from "./components/TermsOfServiceDialog";
import html2canvas from "html2canvas";
import { USER_CLOSE_WEB_SOCKET_CODE } from "./constants";

function App() {
  // 应用状态，三个状态
  // INITIAL（初始，此时界面上是展示上传图片）、
  // CODING（生成代码中，一些展示效果，待确认） 、
  // CODE_READY（代码生成完毕，展示结果，还可以操作update）
  const [appState, setAppState] = useState<AppState>(AppState.INITIAL);
  // 生成的代码
  const [generatedCode, setGeneratedCode] = useState<string>("");
  // 截图
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  // 执行日志，在 generateCode 时，会接收到 “status” 类型的消息，其内容就会保存在这里
  const [executionConsole, setExecutionConsole] = useState<string[]>([]);
  // 更新指令，告诉 AI 要改变什么，即 textarea 输入的内容
  const [updateInstruction, setUpdateInstruction] = useState("");
  // 历史，记录update，存放的结果大体为[generatedCode, updateInstruction]
  const [history, setHistory] = useState<string[]>([]);
  // 设置，先忽略
  const [settings, setSettings] = usePersistedState<Settings>(
    {
      openAiApiKey: null,
      screenshotOneApiKey: null,
      isImageGenerationEnabled: true,
      editorTheme: EditorTheme.COBALT,
      isTermOfServiceAccepted: false,
    },
    "setting"
  );
  // 是否包含当前版本的屏幕截图
  const [shouldIncludeResultImage, setShouldIncludeResultImage] =
    useState<boolean>(false);
  // 通过 websocket 与后台通信
  const wsRef = useRef<WebSocket>(null);

  // 获取当前 desktop 预览的截图
  const takeScreenshot = async (): Promise<string> => {
    const iframeElement = document.querySelector(
      "#preview-desktop"
    ) as HTMLIFrameElement;
    if (!iframeElement?.contentWindow?.document.body) {
      return "";
    }

    const canvas = await html2canvas(iframeElement.contentWindow.document.body);
    const png = canvas.toDataURL("image/png");
    return png;
  };

  const downloadCode = () => {
    // Create a blob from the generated code
    const blob = new Blob([generatedCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    // Create an anchor element and set properties for download
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html"; // Set the file name for download
    document.body.appendChild(a); // Append to the document
    a.click(); // Programmatically click the anchor to trigger download

    // Clean up by removing the anchor and revoking the Blob URL
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setAppState(AppState.INITIAL);
    setGeneratedCode("");
    setReferenceImages([]);
    setExecutionConsole([]);
    setHistory([]);
  };

  // 停止按钮
  const stop = () => {
    wsRef.current?.close?.(USER_CLOSE_WEB_SOCKET_CODE);
    // make sure stop can correct the state even if the websocket is already closed
    setAppState(AppState.CODE_READY);
  };

  function doGenerateCode(params: CodeGenerationParams) {
    setExecutionConsole([]);
    setAppState(AppState.CODING);

    // Merge settings with params
    const updatedParams = { ...params, ...settings };
    // 生成代码的核心函数
    generateCode(
      wsRef,
      updatedParams,
      (token) => setGeneratedCode((prev) => prev + token), // chunk
      (code) => setGeneratedCode(code), // 完整代码
      (line) => setExecutionConsole((prev) => [...prev, line]), // 状态更新
      () => setAppState(AppState.CODE_READY)
    );
  }

  // Initial version creation
  // 初始版本的创建，截图选择或者输入图片URL后触发
  function doCreate(referenceImages: string[]) {
    setReferenceImages(referenceImages);
    if (referenceImages.length > 0) {
      // 初始版本，只需要截图
      doGenerateCode({
        generationType: "create",
        image: referenceImages[0],
      });
    }
  }

  // Subsequent updates
  // 后续更新，update 按钮
  async function doUpdate() {
    const updatedHistory = [...history, generatedCode, updateInstruction];
    if (shouldIncludeResultImage) {
      const resultImage = await takeScreenshot();
      // 更新版本，需要截图，历史记录(包含了updateInstruction)，当前版本的截图（如果有）
      doGenerateCode({
        generationType: "update",
        image: referenceImages[0],
        resultImage: resultImage,
        history: updatedHistory,
      });
    } else {
      doGenerateCode({
        generationType: "update",
        image: referenceImages[0],
        history: updatedHistory,
      });
    }

    setHistory(updatedHistory);
    setGeneratedCode("");
    setUpdateInstruction("");
  }
  // 复制代码
  // useCallback是React提供的一个钩子函数，它用于缓存函数的引用，以便在依赖项未更改时不会重新创建函数。
  // 在这里，generatedCode作为依赖项传递给useCallback，
  // 这意味着只有当generatedCode发生变化时，才会创建新的doCopyCode函数。
  // 这可以帮助提高性能，避免不必要的函数重新创建。
  const doCopyCode = useCallback(() => {
    copy(generatedCode);
    toast.success("Copied to clipboard");
  }, [generatedCode]);

  const handleTermDialogOpenChange = (open: boolean) => {
    setSettings((s) => ({
      ...s,
      isTermOfServiceAccepted: !open,
    }));
  };

  return (
    <div className="mt-2">
      {IS_RUNNING_ON_CLOUD && <PicoBadge />}
      {IS_RUNNING_ON_CLOUD && (
        <TermsOfServiceDialog
          open={!settings.isTermOfServiceAccepted}
          onOpenChange={handleTermDialogOpenChange}
        />
      )}

      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-96 lg:flex-col">
        <div className="flex grow flex-col gap-y-2 overflow-y-auto border-r border-gray-200 bg-white px-6">
          <div className="flex items-center justify-between mt-10">
            <h1 className="text-2xl ">Screenshot to Code</h1>
            <SettingsDialog settings={settings} setSettings={setSettings} />
          </div>
          {appState === AppState.INITIAL && (
            <h2 className="text-sm text-gray-500 mb-2">
              Drag & drop a screenshot to get started.
            </h2>
          )}

          {IS_RUNNING_ON_CLOUD && !settings.openAiApiKey && <OnboardingNote />}

          {(appState === AppState.CODING ||
            appState === AppState.CODE_READY) && (
            <>
              {/* Show code preview only when coding */}
              {appState === AppState.CODING && (
                <div className="flex flex-col">
                  <div className="flex items-center gap-x-1">
                    <Spinner />
                    {/* 展示当前最新的一条执行日志 */}
                    {executionConsole.slice(-1)[0]}
                  </div>
                  <div className="flex mt-4 w-full">
                    <Button onClick={stop} className="w-full">
                      Stop
                    </Button>
                  </div>
                  {/* 行内样式的内容预览 */}
                  <CodePreview code={generatedCode} />
                </div>
              )}

              {appState === AppState.CODE_READY && (
                <div>
                  <div className="grid w-full gap-2">
                    <Textarea
                      placeholder="Tell the AI what to change..."
                      onChange={(e) => setUpdateInstruction(e.target.value)}
                      value={updateInstruction}
                    />
                    <div className="flex justify-between items-center gap-x-2">
                      <div className="font-500 text-xs text-slate-700">
                        Include screenshot of current version?
                      </div>
                      <Switch
                        checked={shouldIncludeResultImage}
                        onCheckedChange={setShouldIncludeResultImage}
                      />
                    </div>
                    <Button onClick={doUpdate}>Update</Button>
                  </div>
                  <div className="flex items-center gap-x-2 mt-2">
                    <Button
                      onClick={downloadCode}
                      className="flex items-center gap-x-2"
                    >
                      <FaDownload /> Download
                    </Button>
                    <Button
                      onClick={reset}
                      className="flex items-center gap-x-2"
                    >
                      <FaUndo />
                      Reset
                    </Button>
                  </div>
                </div>
              )}

              {/* Reference image display */}
              <div className="flex gap-x-2 mt-2">
                <div className="flex flex-col">
                  <div
                    className={classNames({
                      "scanning relative": appState === AppState.CODING,
                    })}
                  >
                    <img
                      className="w-[340px] border border-gray-200 rounded-md"
                      src={referenceImages[0]}
                      alt="Reference"
                    />
                  </div>
                  <div className="text-gray-400 uppercase text-sm text-center mt-1">
                    Original Screenshot
                  </div>
                </div>
                <div className="bg-gray-400 px-4 py-2 rounded text-sm hidden">
                  <h2 className="text-lg mb-4 border-b border-gray-800">
                    Console
                  </h2>
                  {executionConsole.map((line, index) => (
                    <div
                      key={index}
                      className="border-b border-gray-400 mb-2 text-gray-600 font-mono"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <main className="py-2 lg:pl-96">
        {appState === AppState.INITIAL && (
          <div className="flex flex-col justify-center items-center gap-y-10">
            <ImageUpload setReferenceImages={doCreate} />
            <UrlInputSection
              doCreate={doCreate}
              screenshotOneApiKey={settings.screenshotOneApiKey}
            />
          </div>
        )}

        {(appState === AppState.CODING || appState === AppState.CODE_READY) && (
          <div className="ml-4">
            <Tabs defaultValue="desktop">
              <div className="flex justify-end mr-8 mb-4">
                <TabsList>
                  <TabsTrigger value="desktop" className="flex gap-x-2">
                    <FaDesktop /> Desktop
                  </TabsTrigger>
                  <TabsTrigger value="mobile" className="flex gap-x-2">
                    <FaMobile /> Mobile
                  </TabsTrigger>
                  <TabsTrigger value="code" className="flex gap-x-2">
                    <FaCode />
                    Code
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="desktop">
                <Preview code={generatedCode} device="desktop" />
              </TabsContent>
              <TabsContent value="mobile">
                <Preview code={generatedCode} device="mobile" />
              </TabsContent>
              <TabsContent value="code">
                <div className="relative">
                  <CodeMirror
                    code={generatedCode}
                    editorTheme={settings.editorTheme}
                    onCodeChange={setGeneratedCode}
                  />
                  <span
                    title="Copy Code"
                    className="flex items-center justify-center w-10 h-10 text-gray-500 hover:bg-gray-100 cursor-pointer rounded-lg text-sm p-2.5 absolute top-[20px] right-[20px]"
                    onClick={doCopyCode}
                  >
                    <FaCopy />
                  </span>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
