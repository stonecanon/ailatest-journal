//检索的点击动作，调用Template.Search.js获取json并提交后台
var Submit = (function ($) {
    //orderby:传value用于选中排序项
    //groupby:传value用于选中分组项GetQueryString
    //switchdata：会议里选中tab选项卡之后，需要更换左侧导航栏  search  leftnavi:不为空的时候传index和value,用于导航路径的展示
    //sign:是否改变下侧分组，默认改变
    function common(param, displaymode, pageindex, pagecount, orderby, groupby, switchdata, index, value, type, sign, object) {
        type = type ? type : $.GetType();

        // if (!index) {
        //     if (type == "degreeunits") {
        //         index = $("#leftnavi div.guide").find("ul.contentbox li.on").length == 0 ? "" :index;
        //     }
        //     else if (type == "DPaper3") {
        //         index = $("#leftnavi div.guide").find("ul.contentbox li.on").length > 0 ?
        //             parseInt($("#leftnavi div.guide").index($("#leftnavi div.guide ul.contentbox li.on").parent().parent())) + 1 : "1";
        //     }
        //     else {
        //         index = $("#leftnavi div.selected") == 0 ? "1" : parseInt($("#leftnavi div.guide").index($("#leftnavi div.selected"))) + 1;
        //     }
        //  }


        if (!index) {
            if ($("#leftnavi div.selected").length > 0) {
                index = $("#leftnavi div.selected").attr("index");
            } else {
                index = "";
            }

            // if (type == "degreeunits") {
            //     index =  $("#leftnavi div.guide.selected").find("ul.contentbox li.on").length == 0 ? "" : index;
            // }
        }
        if (type == "conferences" && switchdata == "search" && $("#leftnavi .dh_bar li").index($("#leftnavi .dh_bar li.cur")) > -1 && (parseInt($("#txt_1_sel").find("option:selected").attr("type")) - 1) != $("#leftnavi .dh_bar li").index($("#leftnavi .dh_bar li.cur"))) {
            naviswitch.SwitchDefault("conferences", $("#txt_1_sel").find("option:selected").attr("type"), "", "", "", "", true);
        }
        if (typeof (displaymode) != "number") displaymode = $.GetDisplayMode();
        if (typeof (pageindex) != "number") pageindex = 1;
        if (typeof (pagecount) != "number") {
            if (type == "all") pagecount = 10; else pagecount = displaymode == 2 || type == "conferences" ? 20 : 21;
        }

        if (!orderby || orderby == "") {
            orderby = $.GetOrderBy();
        }
        if (!groupby || groupby == "") {
            groupby = $.GetGroupBy();
        }
        param["displaymode"] = displaymode;
        param["pageindex"] = pageindex;
        param["pagecount"] = pagecount;
        param["index"] = index;
        //头部检索类型
        var searchType = $("#txt_1_sel").find("option:selected").text();
        param["searchType"] = searchType;
        var parentcode = $.GetParentCode();
        param["parentcode"] = parentcode;
        //左侧点击导航
        if (typeof (value) === "undefined") {
            param["clickName"] = '';
        } else {
            param["clickName"] = value;
        }
        if (typeof (switchdata) === "undefined") {
            param["switchdata"] = '';
        } else {
            param["switchdata"] = switchdata;
        }
        var url;
        var urlGroup;
        var hytype = $(".dh_bar li.cur a").attr("id");
        switch (type) {
            case "conferences":
                var $seriesGroup = $('#series_group.series_group');
                if($seriesGroup.length > 0){
                    $seriesGroup.remove();
                }
                hytype = hytype ? hytype : "lwj";
                url = AppPath + "/conferences/searchbaseinfo/" + hytype;
                urlGroup = AppPath + "/conferences/" + hytype+ "/group";
                break;
            default:
                type = type ? type : "all";
                url = AppPath + "/" + type + "/searchbaseinfo";
                break;
        }
        ajaxSubmit.Submit(url, param, function (data) {
            $.HandleData(data, param, orderby, groupby, sign, param["productcode"]);
            if (switchdata == "search" || switchdata == "leftnavi" || switchdata == "clickTabSearch") {
                $.SetNaviHtml(index, value, hytype, switchdata, object);
            }

            function setdisplay(obj) {
                var tab = $("#leftnavi .dh_bar");
                if (tab.length == 0 || $(tab).find("li").index($(tab).find("li.cur")) != 2) return;
                if ($("#leftnavi div.guide").index($(obj).parent()) == 0) {
                    $("#searchResult div.meeting_classify").css("display", "block");
                } else {
                    $("#searchResult div.meeting_classify").remove();
                }
            }

            setdisplay($("#leftnavi .selected div.item"));
            /**
             * 不展示 出版物分组条件选择
             */
            if ((index == "NRTO8OJN" || index == "UA91OTB4") && type == "degreeunits") {
                $(".grouplist .group_by").remove();
            }
            $("img.lazy").lazyload({
                effect: "show", threshold: 200, errimage: AppPath + "/images/nopic1.gif"
            });
            var yearbooksType = $.getQueryParam("type");
            if ($("ul.doctype li.active").text().trim() === "全部" && $("ul.doctype li").length > 0 && type == 'yearbooks' && yearbooksType) {
                if (yearbooksType === 'statistics') {
                    $("ul.doctype li a:contains('统计年鉴')").click();
                } else if (yearbooksType === 'industry') {
                    $("ul.doctype li a:contains('专门性年鉴')").click();
                }
            }
            // 新增逻辑：检查并请求替换series_group内容
            var $seriesGroup = $('#series_group.series_group');
            if ($seriesGroup.length > 0) {
                // 使用深拷贝避免参数污染
                var groupParam = $.extend({}, param);
                ajaxSubmit.Submit(urlGroup, groupParam, function (groupData) {
                    if (groupData.length > 0){
                        // 替换HTML内容并重新初始化懒加载
                        $seriesGroup.html(groupData);
                        $seriesGroup.show();
                        $("img.lazy").lazyload({
                            effect: "show",
                            threshold: 200,
                            errimage: AppPath + "/images/nopic1.gif"
                        });
                    }

                }, "#series_group"); // 确保将结果渲染到指定容器
            }
        }, "#rightnavi");
    }

    function settext() {
        var obj = SearchCondition.getObj("subject");
        if (obj && obj.ChildItems && obj.ChildItems.length > 0) {
            if (obj.ChildItems[0].Items && obj.ChildItems[0].Items.length == 1) {
                var index = $("#txt_1_sel option").index($("#txt_1_sel option[value^='" + obj.ChildItems[0].Items[0].Name + "']"));
                $("#txt_1_sel").get(0).selectedIndex = index;
                $("#txt_1_value1").val(obj.ChildItems[0].Items[0].Value.replace(/(^')|\?|('$)/g, ""));
            }
            if (obj.ChildItems.length == 2) {
                if (obj.ChildItems[1].Items && obj.ChildItems[1].Items.length == 1) {
                    $("#year_from").val(obj.ChildItems[1].Items[0].Value);
                    $("#year_to").val(obj.ChildItems[1].Items[0].Value2);
                }
            }
        }

    }

    /**
     * 父级checkbox控制所有子级checkbox的选择状态，并在子级全部选中时标记父级为选中状态，部分选中时标记父级为部分选中状态：
     * @param obj
     */
    function extracted(obj) {

    }

    function lastSearch(type) {
        var searchword = $("#txt_1_value1").val();
        var searchJson = SearchCondition.Search(type);
        // $("#txt_1_value1").val($("#txt_1_value1").val().replace(/\'|"|(|)/g, ""));
        $("#txt_1_value1").val(searchword);
        // if (type.indexOf("DPaper") > -1)
        //     type = "DPaper" + $("#txt_1_sel").find("option:selected").attr("type");
        $(".contentbox li").removeClass("on");
        $(".contentbox li dl dd").removeClass("on");
        var checkedStatus = $(".contentbox li ").find('input[type="checkbox"]:checked');
        const checkboxesArray = Array.from(checkedStatus);
        var liS = $(".contentbox li ").find(':checkbox');
        const liCheckboxs = Array.from(liS);
        // 二级导航取消半选状态
        liCheckboxs.forEach(function (checkbox) {
            checkbox.indeterminate = false;
            checkbox.checked = false
        });
        checkboxesArray.forEach(function (checkbox) {
            checkbox.checked = false;
            if ($(checkbox).parent().is("span")) {
                $(checkbox).closest("li").removeClass("on")
            } else if ($(checkbox).parent().is("dd")) {
                $(checkbox).siblings("a").removeClass("on")
            }
        });
        var halfCheckedStatus = $(".contentbox li ").find('input[type="checkbox"]:checked');
        if (searchJson) {
            var param = {searchStateJson: searchJson};
            var index = "";
            common(param, "", "", "", "", "", "search", index, "", type);

        }
    }

    return {
        //displaymode:展示模式，1：详情，2：列表，传空或者不传，先查找是否有展示模式，没有就默认列表
        //pageindex： 当前页
        //pagecount：每页的条数，做以后扩展20，50，100用
        directSearch: function (displaymode, pageindex, pagecount) {
            settext();
            var param = {searchStateJson: SearchCondition.DirectSearch()};
            common(param, displaymode, pageindex, pagecount);
        }, search: function (type) {
            if (type) {
                var search = $.GetQueryString("q");//原search 检索词
                var selectfieldMap = $.GetQueryString("field"); //原检索下标
                var date = $.GetQueryString("date");
                if (search) {
                    $("#txt_1_value1").val(search);
                    $("#txt_1_sel option").eq(0).attr('selected', 'selected');
                    $("#txt_1_sel option").each(function () {
                        var fieldMap = $(this).val();
                        if (selectfieldMap != null && fieldMap.toUpperCase().indexOf(selectfieldMap.toUpperCase()) > -1) {
                            $(this).attr('selected', 'selected');
                            return false;
                        }
                    });
                }
                if (date) {
                    $("#year_from").val(date.split('-')[0]);
                    $("#year_to").val(date.split('-')[1]);
                }
            }
            if ($("#txt_1_value1").val() == '' || $.trim($("#txt_1_value1").val()) == '' || $("#txt_1_value1").val() == $('#txt_1_value1').attr('placeholder')) {
                alert(Msg.NoSearchKeyWord);
                return;
            }
            if ($("#txt_1_value1").val().indexOf('<') != -1 || $("#txt_1_value1").val().indexOf('>') != -1 || $("#txt_1_value1").val().indexOf('\'') != -1 || $("#txt_1_value1").val().indexOf('"') != -1 || $("#txt_1_value1").val() == $('#txt_1_value1').attr('placeholder')) {
                alert(Msg.DangerTips);
                return;
            }
            if ($("#leftnavi").length == 0 || $("#rightnavi").length == 0) {
                type = type ? type : $.GetType(true);

                var searchword = $("#txt_1_value1").val().replace(/\'|"|(|)/g, "");
                location.href = AppPath + "/" + type + "/search?" + getPlatformCode() + "&q=" + (searchword ? encodeURIComponent($.trim(searchword)) : "") + "&field=" + $("#txt_1_sel option:selected").attr("value").replace(/\||%|=|\?/g, '') + "&date=" + ($("#year_from").val() && $("#year_from").val() != '不限' ? ($("#year_from").val() + "-" + $("#year_to").val()) : "");
                return false;
            }
            var type = type ? type : $.GetType();
            if (type == "conferences" && $("#leftnavi .dh_bar li").index($("#leftnavi .dh_bar li.cur")) > -1 && (parseInt($("#txt_1_sel").find("option:selected").attr("type")) - 1) != $("#leftnavi .dh_bar li").index($("#leftnavi .dh_bar li.cur"))) {
                var hytype = $("#txt_1_sel").find("option:selected").attr("type")
                if (hytype){
                    naviswitch.Constraint('conferences',hytype,'','',false,function (){
                        lastSearch(type);
                    });
                }
            }else {
                lastSearch(type);
            }
        }, // index：点击的第几个导航 目前收集检索条件的时候不使用该值，使用1如果需要多导航，则使用该值,
        // field：使用的字段代码 AB,
        // val:点击的值 A002
        // text:点击的文本值 用于上路导航路径的设置
        naviSearch: function (index, field, val, text, obj) {
            var param;
            // // 处理复选子选方法
            var resource = $("#hidResourceType").val();
            if ("yearbooks" == resource) {
                // $(obj).parent().find('input[type="checkbox"]').click();
                var checkbox = $(obj).parent().find('input[type="checkbox"]');
                if (checkbox.prop('checked')) {
                    checkbox.prop('checked', false);
                } else {
                    checkbox.prop('checked', true);
                }
                if ($(obj).parent().is("span")) {
                    Submit.parentCheckboxChanged(checkbox, "tagA")
                } else if ($(obj).parent().is("dd")) {
                    Submit.childCheckboxChanged(checkbox, "tagA")
                }
                var checkboxes = $(obj).closest('.contentbox').find('input[type="checkbox"]:checked');
                var selectedValues = checkboxes.map(function () {
                    return $(this).val() + "?";
                }).get();
                // 输出选中的复选框的 value 属性数组
                val = selectedValues.join(" + ");
                if (val.endsWith("?")) {
                    val = val.slice(0, -1);
                }
            }
            $("#txt_1_value1").val('');
            if ($("#year_from").length == 1) {
                $("#year_from").val('');
                $("#year_to").val('');
                $("#year_from").focus();
                $("#year_from").blur();
                $("#year_to").focus();
                $("#year_to").blur();
            }
            if (index == "kernel" && "journals" == $.GetType()) {
                $("#hxqk").attr("checked", true);
                $("#hxqk").attr("disabled", "disabled");

                cnkiSearch.DelSearchJsonInfo("group", "北大核心");
                SearchCondition.Group("北大核心", "BDHXF", "1");
            } else if ($("#hxqk").length == 1) {
                $("#hxqk").removeAttr("disabled");
            }
            if (val) {
                var naveres = $(".guide.selected").attr("navires");
                val = ($.GetType() == "degreeunits" && (naveres == "ACADEMICSUBJECT" || naveres == "PROFESSIONALSUBJECT")) || val == text ? val : val + "?";
            }
            if (window.urlturn && $(".doctype").length == 0 && $.GetQueryString("productcode") && $("#hidNaviValue").val()) {
                param = {searchStateJson: SearchCondition.Navi(index, field, val, $.GetQueryString("productcode").toUpperCase())};
                param["productcode"] = $.GetQueryString("productcode").toUpperCase();
            }
            if (!param) param = {searchStateJson: SearchCondition.Navi(index, field, val)};
            common(param, "", "", "", "", "", "leftnavi", index, text, "", "", obj);

        }, parentCheckboxChanged: function (obj, type) {

            var childCheckboxes = obj.parent().parent().find("dl input[type='checkbox']");
            const checkboxesArray = Array.from(childCheckboxes);
            $(obj).prop('indeterminate', false);
            if (obj.get(0).checked) {
                // 如果父复选框被选中，则全部子复选框也被选中
                checkboxesArray.forEach(function (checkbox) {
                    checkbox.checked = true;
                });
                $(obj).prop('checked', true);
            } else {
                // 否则，全部子复选框均不被选中
                checkboxesArray.forEach(function (checkbox) {
                    checkbox.checked = false;
                });
                $(obj).prop('checked', false);
            }
            if (type !== "tagA") {
                if (obj.prop('checked')) {
                    obj.prop('checked', false);
                } else {
                    obj.prop('checked', true);
                }
                obj.siblings('a').click();
            }
        }, // 子复选框的 change 事件处理函数
        childCheckboxChanged: function (obj, type) {

            var parentCheckbox = obj.parent().parent().parent().find("span input[type='checkbox']").get(0);
            var childCheckboxes = obj.parent().parent().find("dd input[type='checkbox']");
            var checkedChildren = obj.parent().parent().find("dd input[type='checkbox']:checked");

            if (checkedChildren.length === 0) {
                // 如果没有子复选框被选中，则父复选框不选中
                parentCheckbox.checked = false;
                parentCheckbox.indeterminate = false;
            } else if (checkedChildren.length === childCheckboxes.length) {
                // 如果全部子复选框被选中，则父复选框选中
                parentCheckbox.checked = true;
                parentCheckbox.indeterminate = false;
            } else {
                // 否则，父复选框半选中
                parentCheckbox.indeterminate = true;
            }
            if (type !== "tagA") {
                if (obj.prop('checked')) {
                    obj.prop('checked', false);
                } else {
                    obj.prop('checked', true);
                }
                obj.siblings('a').click();
            }
        },

        // 父级checkbox控制所有子级checkbox的选择状态，并在子级全部选中时标记父级为选中状态，部分选中时标记父级为部分选中状态
        checkboxChange: function (obj) {
            let parentCheckbox, childCheckboxes;
            if (obj.parent().is('a')) {
                parentCheckbox = obj.get(0);
                childCheckboxes = obj.parent().parent().parent().find("dl input[type='checkbox']");
            } else {
                parentCheckbox = obj.parent().parent().parent().find("span input[type='checkbox']").get(0);
                childCheckboxes = obj.parent().parent().find("dd input[type='checkbox']");
            }
            const checkboxesArray = Array.from(childCheckboxes);
            parentCheckbox.addEventListener('change', function () {
                checkboxesArray.forEach(checkbox => {
                    checkbox.checked = parentCheckbox.checked;
                });
            });

            checkboxesArray.forEach(checkbox => {
                // checkbox.addEventListener('change', function () {
                let allChecked = true;
                let someChecked = false;
                checkboxesArray.forEach(child => {
                    if (child.checked) {
                        someChecked = true;
                    } else {
                        allChecked = false;
                    }
                });

                if (allChecked) {
                    parentCheckbox.checked = true;
                    parentCheckbox.indeterminate = false;
                } else if (someChecked) {
                    parentCheckbox.checked = false;
                    parentCheckbox.indeterminate = true;
                } else {
                    parentCheckbox.checked = false;
                    parentCheckbox.indeterminate = false;
                }
                // });
            });
            this.callback(obj);
            // obj.parent().parent().find("a").click();
        }, callback: function (obj) {
            obj.parent().parent().find("a").get(0).click();
        }, delUrlParamType() { //删除url中的type参数
            var search = window.location.search.substring(1); // 获取当前URL的查询字符串部分
            var parameters = search.split('&'); // 分割参数
            // 过滤掉不需要的参数
            var filteredParams = parameters.filter(function (param) {
                return param.split('=')[0] !== "type";
            });
            // 重建查询字符串
            var newSearch = filteredParams.join('&');
            // 构建新的URL
            var newUrl = window.location.pathname + (newSearch.length > 0 ? '?' + newSearch : '') + window.location.hash;
            // 更新浏览器地址栏
            window.history.pushState({path: newUrl}, '', newUrl);
        }, clickTabSearch: function (obj) {
            //如果当前点击的tab不是已订阅，则删除已订阅属性。已订阅tab没有productcode属性
            if($(obj).attr("productcode")||$(obj).parents("li").attr("productcode")){
                cnkiSearch.setQueryState("QNode/Subscribed","");
                cnkiSearch.DelSearchJsonInfo("NaviSubscribe");
                // $("#navicodecondition").val('');
            }
            cnkiSearch.DelSearchJsonInfo("Navi");
            this.delUrlParamType();
            $("#rightnavi ul.doctype li").removeClass();
            $(obj).parent().addClass("active");
            if ($("#leftnavi div.guide[class!='guide selected']").find("li.on").length == 1) {
                $("#leftnavi div.guide[class!='guide selected']").find("li.on").parent().prev().click();
            }
            var type = $.GetType(true);
            var hytype = $("#leftnavi .dh_bar li").length == 0 ? "" : $("#leftnavi .dh_bar li.cur").find("a").attr("id");
            var index = $("#leftnavi div.selected").attr("index");
            var value = $("#leftnavi div.selected") == 0 || $("#leftnavi div.selected ul.contentbox li.on").length == 0 ? "" : ($("#leftnavi div.selected ul.contentbox dl dd a.on").length == 0 ? $("#leftnavi div.selected ul.contentbox li.on span a").attr("title") : $("#leftnavi div.selected ul.contentbox dl dd a.on").attr("title"));
            var naviCode = $("#leftnavi div.selected") == 0 || $("#leftnavi div.selected ul.contentbox li.on").length == 0 ? "" :
                ($("#leftnavi div.selected ul.contentbox dl dd a.on").length == 0 ? $("#leftnavi div.selected ul.contentbox li.on span a").attr("value") : $("#leftnavi div.selected ul.contentbox dl dd a.on").attr("value"));
            // 切换非OA期刊是清楚 选择
            if (type == "journals" && "OA期刊" != obj.text) {
                $('#mixOa').prop('checked', false);
                cnkiSearch.DelSearchJsonInfo("group", "完全OA期刊");
                $('#comOa').prop('checked', false);
                cnkiSearch.DelSearchJsonInfo("group", "混合OA期刊");
            }

            var param = {searchStateJson: SearchCondition.TabSearch()};
            naviswitch.SwitchDefault(type, hytype, index, value, "", "", true, naviCode);
            if (!value) common(param, "", "", "", "", "", "clickTabSearch", "");
        }, dpaper: function (index) {
            cnkiSearch.DelSearchJsonInfo("Navi");
            var param = {searchStateJson: SearchCondition.TabSearch()};
            common(param, "", "", "", "", "", "leftnavi", index);
        }, //name:排序的名称，
        //orderType:排序类型,desc或者asc
        order: function (name, orderType) {
            settext();
            var param = {searchStateJson: SearchCondition.Order(name, orderType)};
            common(param, "", "", "", name + "|" + orderType, '', '', '', '', '', true);
        }, //name:分组的名称
        //field:按照哪个字段分组
        //value:分组的值
        //sign:是否改变下侧分组，默认改变
        group: function (name, field, value, sign) {
            settext();
            var param = {searchStateJson: SearchCondition.Group(name, field, value)};
            common(param, "", "", "", "", "", "", "", '', '', true);
            $('html, body').animate({
                scrollTop: 0
            }, 10);
        }, pageTopTurn: function (obj, addNum) {
            settext();
            var num = parseInt($(obj).siblings("#txtPageGoToBottom").text());
            var count = parseInt($("#lblPageCount").html());
            if ((num >= count && addNum == 1) || (num <= 1 && addNum == -1)) return;
            var param = {searchStateJson: SearchCondition.DirectSearch()};
            common(param, "", num + addNum, "", "", "", "", "", "", "", true);
            $('html, body').animate({
                scrollTop: 0
            }, 10);
        }, pageBottomTurn: function (obj, addNum) {
            settext();
            var num = parseInt($.trim($(obj).siblings(".active").html()));
            var count = parseInt($("#lblPageCount").html());
            if ((num >= count && addNum == 1) || (num <= 1 && addNum == -1)) return;
            var param = {searchStateJson: SearchCondition.DirectSearch()};
            common(param, "", num + addNum, "", "", "", "", "", "", "", true);
            $('html, body').animate({
                scrollTop: 0
            }, 10);

        }, pageTurn: function (num) {
            settext();
            var param = {searchStateJson: SearchCondition.DirectSearch()};
            common(param, "", num, "", "", "", "", "", "", "", true);
            $('html, body').animate({
                scrollTop: 0
            }, 10);

        }, tabTurn: function () {
            var param = {searchStateJson: SearchCondition.TabTurn()};
            param["productcode"] = $.GetQueryString("productcode") ? $.GetQueryString("productcode").toUpperCase() : $.GetProductCode();
            common(param, "", "", "", "", "", "clickTabSearch", "");
        }, hxqk: function (obj) {
            var comOa = $("#comOa").is(":checked");
            var mixOa = $("#mixOa").is(":checked");
            var hxqk = $("#hxqk").is(":checked");
            var tjyqkChkd = $("#tjyqkChkd").is(":checked");
            var hxqkChkd = $("#hxqkChkd").is(":checked");
            var param;
            if (comOa && mixOa) {
                if (obj.id == 'comOa') {
                    $('#mixOa').prop('checked', false);
                    mixOa = false;
                } else {
                    $('#comOa').prop('checked', false);
                    comOa = false;
                }
            }
            if (comOa) {
                param = {searchStateJson: SearchCondition.Group("完全OA期刊", "OA", "1")};
            } else {
                cnkiSearch.DelSearchJsonInfo("group", "完全OA期刊");
                param = {searchStateJson: SearchCondition.DirectSearch()};
            }
            if (mixOa) {
                param = {searchStateJson: SearchCondition.Group("混合OA期刊", "OA", "2")};
            } else {
                cnkiSearch.DelSearchJsonInfo("group", "混合OA期刊");
                param = {searchStateJson: SearchCondition.DirectSearch()};
            }
            if (hxqk) {
                param = {searchStateJson: SearchCondition.Group("核心期刊", "BDHXF", "1")};
            } else {
                cnkiSearch.DelSearchJsonInfo("group", "核心期刊");
                param = {searchStateJson: SearchCondition.DirectSearch()};
            }
            if (tjyqkChkd) {
                param = {searchStateJson: SearchCondition.Group("统计源期刊", "EI", "9001")};
            } else {
                cnkiSearch.DelSearchJsonInfo("group", "统计源期刊");
                param = {searchStateJson: SearchCondition.DirectSearch()};
            }
            if (hxqkChkd) {
                param = {searchStateJson: SearchCondition.Group("核心期刊(2023版)", "BDHXF", "1")};
            } else {
                cnkiSearch.DelSearchJsonInfo("group", "核心期刊(2023版)");
                param = {searchStateJson: SearchCondition.DirectSearch()};
            }
            common(param);

            // if ($(obj).is(":checked")) {
            //     var param = {searchStateJson: SearchCondition.Group("核心期刊", "BDHXF", "1")};
            //     common(param);
            // } else {
            //     cnkiSearch.DelSearchJsonInfo("group", "核心期刊");
            //     var param = {searchStateJson: SearchCondition.DirectSearch()};
            //     common(param);
            // }
        }
    }
})(jQuery);

//键盘监听按键
document.onkeydown = function (e) {
    e = window.event || e;
    var srcEl = e .srcElement ? e .srcElement : e .target;
    var tagstr = srcEl.tagName;
    var reTag = /input|select/gi;
    switch (e.keyCode) {
        case 13: //回车
            if (document.activeElement.id == "txtPageGoToBottom") {
                Submit.pageTurn(parseInt($("#txtPageGoToBottom").val()));
            } else if (document.activeElement.id == "txt_1_value1" || document.activeElement.id == "year_from" || document.activeElement.id == "year_to" || document.activeElement.id == "txt_1_sel") {
                if (document.activeElement.id == "year_from") {
                    $("#year_to").focus();
                    $("#year_to").blur();
                } else if (document.activeElement.id == "year_to") {
                    $("#year_from").focus();
                    $("#year_from").blur();
                }
                Submit.search();
            }
            break;
        case 37: //左键
            if(reTag.test(tagstr)){
                break;
            }
            Submit.pageTopTurn($(".toolsbar .butL"), -1);
            break;
        case 38: //向上键
            break;
        case 39: //右键
            if(reTag.test(tagstr)){
                break;
            }
            Submit.pageTopTurn($(".toolsbar .butR"), 1);
            break;
        case 40: //向下键
            break;
        default:
            break;
    }
};

$(function () {
    setcnkiuserkey();

    function setcnkiuserkey() {
        //设置cookie（GUID）
        SetCookie("cnkiUserKey", SetNewGuid(), 3650);
    }

    //设置新的GUID
    function SetNewGuid() {
        var guid = "";
        for (var i = 1; i <= 32; i++) {
            var n = Math.floor(Math.random() * 16.0).toString(16);
            guid += n;
            if ((i == 8) || (i == 12) || (i == 16) || (i == 20)) guid += "-";
        }
        return guid;
    }


    $(".csmart").click(function() {
        var c = encodeURIComponent($.trim($("#txt_1_value1").val()));
        if (language == "EN") {
            window.open("https://aismart.oversea.cnki.net/inds/aigc?sysid=4&lang=en&w=" + c)
        } else {
            window.open("https://aismart.oversea.cnki.net/inds/aigc?sysid=4&w=" + c)
        }
    })
});

//设置cookie
function SetCookie(name, value, expiredays) {
    if (GetCookie(name) == "" || GetCookie(name) == null) {
        var exdate = new Date();
        exdate.setDate(exdate.getDate() + expiredays);
        document.cookie = name + "=" + escape(value) + (document.location.href.toLowerCase().indexOf('cnki.net') > 0 ? (//((expiredays == null) ? "" : ";expires=" + exdate.toGMTString()) + ";path=/;domain=cnki.net"
            ((expiredays == null) ? "" : ";expires=" + exdate.toGMTString()) + ";path=/;domain=cnki.net") : ((expiredays == null) ? "" : ";expires=" + exdate.toGMTString()) + ";path=/");
    }
}

//读取cookies
function GetCookie(name) {
    if (document.cookie.length > 0) {
        c_start = document.cookie.indexOf(name + "=");
        if (c_start != -1) {
            c_start = c_start + name.length + 1;
            c_end = document.cookie.indexOf(";", c_start);
            if (c_end == -1) c_end = document.cookie.length;
            return unescape(document.cookie.substring(c_start, c_end));
        }
    }
    return "";
}

//清楚Cookie
function DeleteCookie(name) {
    //$.cookie(name, null, { path: '/',domain: document.location.href.toLowerCase().indexOf('cnki.net') > 0 ? "cnki.net" : "" });
    var exdate = new Date();
    exdate.setTime(exdate.getTime() - 1);
    var cval = GetCookie(name);
    if (cval != null) document.cookie = name + "=" + escape(cval) + document.location.href.toLowerCase().indexOf('cnki.net') > 0 ? (";expires=" + exdate.toGMTString() + "; path=/;" + "domain=cnki.net") : (";expires=" + exdate.toGMTString() + "; path=/");
}

//渲染浏览历史
function renderViewHis() {
    if (!window.localStorage) return;

    var code = $("#hidResourceType").val();
    if (!code || code == "") return;
    var hidDefaultPlatForm = $("#hidDefaultPlatForm").val();
    var dataJson = window.localStorage.getItem("knavi_view_his_" + hidDefaultPlatForm);
    if (dataJson == "" || dataJson == null) return;

    var data = JSON.parse(dataJson);
    var html = "";

    if (code == "all") {
        var arrItems = [];
        if (data["journals"]) arrItems = arrItems.concat(data["journals"]);
        if (data["jjournals"]) arrItems = arrItems.concat(data["jjournals"]);
        if (data["degreeunits"]) arrItems = arrItems.concat(data["degreeunits"]);
        if (data["conferences"]) arrItems = arrItems.concat(data["conferences"]);
        if (data["newspapers"]) arrItems = arrItems.concat(data["newspapers"]);
        if (data["yearbooks"]) arrItems = arrItems.concat(data["yearbooks"]);


        arrItems.sort(function (a, b) {
            return (Date.parse(b.dt) > Date.parse(a.dt)) ? 1 : (Date.parse(b.dt) == Date.parse(a.dt)) ? 0 : -1;
        });

        for (var i = 0; i < (arrItems.length > 8 ? 8 : arrItems.length); i++) {
            html += getItemHtml(arrItems[i]);
        }
    } else {
        if (data[code] && data[code].length > 0) {
            for (var i = 0; i < data[code].length; i++) {
                html += getItemHtml(data[code][i]);
            }
        }
    }

    if (html != "") {
        var htmlContent;
        if (language.toUpperCase() != 'EN') {
            htmlContent = "<div class='basic clearfix' id='viewHis'><div class='caption'><span><b>" + Msg.recentBrowse + "</b><i>Recent Browse</i></span></div><ul class='tuplist'>" + html;
        } else {
            htmlContent = "<div class='basic clearfix' id='viewHis'><div class='caption'><span><b>" + Msg.recentBrowse + "</b><i></i></span></div><ul class='tuplist'>" + html;
        }
        htmlContent += "</ul></div>";
        $("#filehot").before(htmlContent);
    }

    function getItemHtml(item) {

        if (!item) return "";

        var newText = item.text.length > 14 ? item.text.substring(0, 14) + "..." : item.text;
      var baseId=item.baseId?item.baseId.toLowerCase():'';
        switch (item.code) {
            case "journals":
            case "jjournals":
                return "<li><a target='_blank' href='" + item.url + "' title='" + item.text + "'><span><img class='lazy' data-original='"+c61Url+"/cjfd/small/" + baseId + ".jpg' style='display: inline;'></span><b>" + newText + "</b></a></li>";
            case "degreeunits":
                return "<li><a target='_blank' href='" + item.url + "' title='" + item.text + "'><span><img class='lazy' data-original='"+c61Url+"/cdmdlogo/" + baseId + ".gif' style='display: inline;'></span><b>" + newText + "</b></a></li>";
            case "conferences":
                return "<li><a target='_blank' href='" + item.url + "' title='" + item.text + "'><span><img class='lazy' data-original='"+c61Url+"/cpfd/big/" + baseId.substring(0, 4) + "/" + baseId + ".jpg' style='display: inline;'></span><b>" + newText + "</b></a></li>";
            case "newspapers":
                return "<li><a target='_blank' href='" + item.url + "' title='" + item.text + "'><span><img class='lazy' data-original='"+c61Url+"/ccnd/" + baseId + ".jpg'  width='110' style='display: inline;'></span><b>" + newText + "</b></a></li>";
            case "yearbooks":
                return "<li><a target='_blank' href='" + item.url + "' title='" + item.text + "'><span><img class='lazy' data-original='"+c61Url+"/cyfd/small/"+baseId+"/" + item.id.toLowerCase() + ".jpg' style='display: inline;'></span><b>" + newText + "</b></a></li>";
            default:
                return "";
        }
    }
}

function getTotalFromIndexApi() {
    var apiUrl = $("#indexApiUrl").val();
    if (!apiUrl) {
        return;
    }
    var keyVal = [];
    var introduceId = $('.navi-right .basic.clearfix.is-show').attr('id');
    var param = $(".navi-right").find("em").map(function () {
        if (this.id) {
            if (keyVal.indexOf(this.id) == -1) {
                keyVal.push(this.id);
                return {"indexKey": this.id};
            }
        }
    }).get();
    if (!param || param.length == 0) {
        return;
    }
    $.ajaxSetup({
        headers: {
            'uniplatform': platform
        }
    });
    $.ajax({
        url: apiUrl,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify(param),
        success: function (data) {
            if (data && data.data && data.data.length > 0) {
                if ("journals" === introduceId) {
                    fetchJournalIndexData();
                }
                $.each(data.data, function (idx, item) {
                    var indexKey = item.indexKey;
                    var value = item.value || "0"; // 如果返回值为空，则默认为 "0"
                    if (!!indexKey) {
                        // 替换所有具有相同 id 的 <em> 元素的值
                        $(".navi-right p em#" + indexKey).html(value);
                    }
                });
            } else {
                // 处理数据为空的情况
                // $(".navi-right p").find("em").html("0");
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            // 处理请求失败的情况
            $(".navi-right p").find("em").html("0");
        }
    });
}

//期刊期数指标
function fetchJournalIndexData() {
    $.ajax({
        url: AppPath + "/journals/qkqsIndex",
        type: "GET",
        contentType: "application/json",
        success: function (data) {
            // 判断新接口返回的数据是否正常（根据实际返回的数据结构调整判断条件）
            if (data && typeof data === "object") {
                // 遍历 Map 并处理键值对
                for (const key in data) {
                    if (Object.prototype.hasOwnProperty.call(data, key)) {
                        const value = data[key];
                        // 这里可以根据实际需要处理数据
                        $(".navi-right p em#" + key).html(value);
                    }
                }
            } else {
            }
        },
        error: function (XMLHttpRequst, textStatus, errorThrown) {
            ajaxSubmit.returnVerifyCode(XMLHttpRequst);
        }
    });
}

