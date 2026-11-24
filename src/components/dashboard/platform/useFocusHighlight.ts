import { useState } from "react";
import type { MouseEvent } from "react";

/**
 * 입력 행의 hover·focus 하이라이트 상태.
 * - focused: 행 안의 입력란에 포커스가 있는지 (색은 각 컴포넌트가 인라인 style 로 정한다)
 * - hover: 포커스가 없을 때만 행 배경을 hoverBackground 로 바꿨다가 되돌린다
 */
export function useFocusHighlight(hoverBackground: string) {
  const [focused, setFocused] = useState(false);

  return {
    focused,
    setFocused,
    onMouseEnter: (e: MouseEvent<HTMLDivElement>) => {
      if (!focused) e.currentTarget.style.backgroundColor = hoverBackground;
    },
    onMouseLeave: (e: MouseEvent<HTMLDivElement>) => {
      if (!focused) e.currentTarget.style.backgroundColor = "";
    },
  };
}
