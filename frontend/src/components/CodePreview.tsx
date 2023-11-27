import { useRef, useEffect } from "react";

interface Props {
  code: string;
}

function CodePreview({ code }: Props) {
  // div 元素的引用
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      // code 代码改变时，将scrollRef元素滚动到最右侧位置。
      // 这确保了代码片段显示时滚动到末尾位置。
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [code]);

  // tailwind 类的简写
  // px = padding-left + padding-right
  // my = margin-top + margin-bottom
  return (
    <div
      ref={scrollRef}
      className="w-full px-2 bg-black text-green-400 whitespace-nowrap flex 
      overflow-x-auto font-mono text-[10px] my-4"
    >
      {code}
    </div>
  );
}

export default CodePreview;
