//只涉及到检索条件的组装，根据KQuery.js生成json
var SearchCondition = (function ($) {
    var searchStateJson = ""; //私有属性
    var order = {
        "all": "",
        "journals": "OTA|DESC",
        "jjournals": "OTD|",
        "conferences_lwj": "RT|",
        "conferences_hy": "RT|",
        "conferences_zbdw": "WC|DESC",
        "degreeunits": "RT|",
        "newspapers": "RT|",
        "yearbooks": "RT|DESC",
        "refbooks": "RT|"
    };    //默认排序使用
    function getCondition(type) //私有方法
    {
        searchStateJson = cnkiSearch.getSearchJsonInfo(type);
        return searchStateJson;
    }
    function addQueryItem(name, type, index, field, val, operate, val2, extendtype) {
        var path = name + "/" + type;
        var groupQueryItem = cnkiSearch.getQueryItem();
        var title =$("#leftnavi .guide.selected .wrap").text();
        groupQueryItem.Key = index;
        groupQueryItem.Name = field;
        groupQueryItem.Title =  title?title:"";
        groupQueryItem.Value = val;
        groupQueryItem.Value2 = val2 ? val2 : "";
        groupQueryItem.ExtendType = extendtype ? extendtype : cnkiSearch.ExtendType.NONE;
        groupQueryItem.ExtendType = val.indexOf("=") > -1 ? cnkiSearch.ExtendType.ADDQuery : groupQueryItem.ExtendType;
        if (operate)
            groupQueryItem.Operate = operate;
        if (val && val.length > 0) {
            cnkiSearch.AddSearchJsonInfo(path, groupQueryItem, false);
        }
    }
    //删除多项分组数据
    function delNavi(obj) {

    }
    function defaultOrder() {
        if ($("#rightnavi .grouplist .sortwr ul.sort_list").length != 0)
            return;   //有排序的时候不再考虑默认排序
        var type = $.GetType();
        if(type=="conferences"){
            var hytype=$(".dh_bar li.cur a").attr("id");
            type=type+"_"+hytype;
        }
        var value = order[type];
        cnkiSearch.setQueryState("QNode/OrderBy", value);
    }
    return {
        //其他页面跳转首页时候
        Search: function (type) {

            var orderby = $.GetOrderBy();
            if (!orderby){
                defaultOrder();
            }else{
                SearchQueryState.QNode.OrderBy=orderby
            }


            //SearchCondition.DeleteCondition(type, "1");
            //cnkiSearch.DelSearchJsonInfo("group", "dpapergroup");
            cnkiSearch.setQueryState("CNode/PCode", $.GetProductCode(type));
            return getCondition(type);
        },
        //添加导航条件 
        // index：点击的第几个导航 1,
        // field：使用的字段代码 AB,
        // val:点击的值 A002
        Navi: function (index, field, val,productcode) {
            //点击一级导航去掉选中项并且删除json里的条件
            SearchCondition.DeleteCondition($.GetType(), "1");
            cnkiSearch.DelSearchJsonInfo("subject/txt", "txt_1");
            cnkiSearch.DelSearchJsonInfo("subject/year", "year");
            cnkiSearch.DelSearchJsonInfo("group", "dpapergroup");
            var type = $.GetType();
            //因为会议的主办单位导航的第二和第三个没有分组条件，所以应该删除掉，属于特殊情况特殊处理。
            if (type == "conferences" && $(".dh_bar li.cur a").attr("id")=="zbdw") {
                var num = parseInt($("#leftnavi div.guide").index($("#leftnavi div.selected"))) + 1;
                if (num == "2" || num == "3")
                    cnkiSearch.DelSearchJsonInfo("group", "全部");
            }
            else if (type == "degreeunits" && $(".guide.selected").attr("navires") !="AREA_DRGREE") {
                //不是地域导航删除单位过滤条件
                cnkiSearch.DelSearchJsonInfo("group", "全部单位");
            }
            defaultOrder();
            if (productcode)
                cnkiSearch.setQueryState("CNode/PCode", productcode);
            else
                cnkiSearch.setQueryState("CNode/PCode", $.GetProductCode());
            if (val.indexOf(";") > -1)
                addQueryItem("Navi", type, index, field, field + "=" + val.split(";")[0] + " and " + field + "=" + val.split(";")[1]);
            else if (val.indexOf("；") > -1)
                addQueryItem("Navi", type, index, field, field + "=" + val.split("；")[0] + " and " + field + "=" + val.split("；")[1]);
            else
                addQueryItem("Navi", type, index, field, val);
            return cnkiSearch.getJsonInfo();
        },
        NaviSubscribe: function (index, field, val) {
            //点击一级导航去掉选中项并且删除json里的条件
            SearchCondition.DeleteCondition($.GetType(), "1");
            cnkiSearch.DelSearchJsonInfo("group", "dpapergroup");
            var type = $.GetType();
            defaultOrder();
            cnkiSearch.setQueryState("CNode/PCode", $.GetProductCode());
            addMultiQueryItem("NaviSubscribe", type, index, field, val);

            function addMultiQueryItem(name, type, index, field, val, operate, val2, extendtype) {
                var groupQueryItem = cnkiSearch.getQueryItem();
                groupQueryItem.Key = index;
                groupQueryItem.Name = field;
                groupQueryItem.Value = val;
                groupQueryItem.Value2 = val2 ? val2 : "";
                groupQueryItem.ExtendType = extendtype ? extendtype : cnkiSearch.ExtendType.NONE;
                groupQueryItem.ExtendType = val.indexOf("=") > -1 ? cnkiSearch.ExtendType.ADDQuery : groupQueryItem.ExtendType;
                if (operate)
                    groupQueryItem.Operate = operate;

                var obj=SearchCondition.getObj(name);
                if(obj){
                    obj.Items.push(groupQueryItem);
                }else{
                    addQueryItem("NaviSubscribe", type, index, field, val);
                }
            }
            return cnkiSearch.getJsonInfo();
        },
        //name:排序的名称，
        //orderType:排序类型,RT|或者asc
        Order: function (name, orderType) {
            cnkiSearch.setQueryState("CNode/PCode", $.GetProductCode());
            cnkiSearch.setQueryState("QNode/OrderBy", name + "|" + orderType);
            return cnkiSearch.getJsonInfo();
        },
        //name:分组的名称
        //field:按照哪个字段分组
        //value:分组的值
        Group: function (name, field, value) {
            cnkiSearch.DelSearchJsonInfo("group", name);
            cnkiSearch.setQueryState("CNode/PCode", $.GetProductCode());
            if (field == "DT" && !!value) {

                addQueryItem("group", name, field, field, value+"?", "");
            }
            else {
                if (field)
                    addQueryItem("group", name, field, field, value);
                else
                    addQueryItem("group", name, field, field, value, "");
            }
            return cnkiSearch.getJsonInfo();
        },
        //翻页，排序,不需要搜集检索条件，直接取json
        DirectSearch: function () {
            cnkiSearch.setQueryState("CNode/PCode", $.GetProductCode());
            return cnkiSearch.getJsonInfo();
        },
        //右侧tab选项卡检索，需要获取默认检索
        TabSearch: function () {
            cnkiSearch.DelSearchJsonInfo("group", "dpapergroup");
            defaultOrder();
            cnkiSearch.setQueryState("CNode/PCode", $.GetProductCode());
            return cnkiSearch.getJsonInfo();
        },
        //根据传递的产品来显示tab
        TabTurn: function () {
            cnkiSearch.DelSearchJsonInfo("group", "dpapergroup");
            defaultOrder();
            cnkiSearch.setQueryState("CNode/PCode", $.GetQueryString("productcode")? $.GetQueryString("productcode").toUpperCase():
                $.GetProductCode());
            return cnkiSearch.getJsonInfo();
        },
        DeleteCondition: function (type, index) {
            cnkiSearch.DelSearchJsonInfo("Navi", type);
        },
        getObj: function (path) {
            return cnkiSearch.getQueryConditonV(path);
        }
    }
})(jQuery);





